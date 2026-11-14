// Rate limits in D1 (table auth_attempts). The rules are in src/domain/auth.ts (recordFailure is the readable model
// of the SQL below); this file reserves attempts. Each reservation is ONE atomic upsert that restarts a finished
// window or lock, counts the attempt and sets locked_until, so concurrent requests cannot count once (TD-028).
// Callers reserve BEFORE the expensive password hash and `release` on success.
import { type Limit } from "../../domain/auth";
import type { D1 } from "../env";
import { sha256Hex } from "./tokens";

export async function limitKey(kind: string, value: string): Promise<string> {
  return `${kind}:${await sha256Hex(value)}`;
}

export interface Reserved {
  count: number;
  lockedUntil: number | null;
}

/** Counts one attempt against a key and returns the state it produced. The attempt may go ahead only while
 * `count <= rule.limit`: the attempt that reaches the limit still runs (and sets the lock), every later one is refused
 * until the lock ends. */
export async function reserve(db: D1, key: string, rule: Limit, now: number): Promise<Reserved> {
  const ended =
    "(locked_until IS NOT NULL AND locked_until <= ?1) OR (locked_until IS NULL AND ?1 - window_start >= ?2)";
  const row = await db
    .prepare(
      `INSERT INTO auth_attempts (key, window_start, count, locked_until)
       VALUES (?3, ?1, 1, CASE WHEN 1 >= ?4 THEN ?1 + ?5 END)
       ON CONFLICT(key) DO UPDATE SET
         window_start = CASE WHEN ${ended} THEN ?1 ELSE window_start END,
         count = CASE WHEN ${ended} THEN 1 ELSE count + 1 END,
         locked_until = CASE WHEN ${ended} THEN CASE WHEN 1 >= ?4 THEN ?1 + ?5 END
                             ELSE COALESCE(locked_until, CASE WHEN count + 1 >= ?4 THEN ?1 + ?5 END) END
       RETURNING count, locked_until`,
    )
    .bind(now, rule.windowMs, key, rule.limit, rule.lockMs)
    .first<{ count: number; locked_until: number | null }>();
  if (!row) throw new Error("auth_attempts upsert returned no row");
  return { count: row.count, lockedUntil: row.locked_until };
}

export type Reservation = readonly [key: string, rule: Limit];

/** Reserves one attempt on every key. Returns seconds to wait (0 when all allow the attempt). */
export async function reserveAll(db: D1, reservations: Reservation[], now: number): Promise<number> {
  const states = await Promise.all(reservations.map(([key, rule]) => reserve(db, key, rule, now)));
  let ms = 0;
  states.forEach((s, i) => {
    if (s.count > reservations[i][1].limit && s.lockedUntil !== null) ms = Math.max(ms, s.lockedUntil - now);
  });
  // Housekeeping: counters whose window and lock are long over.
  await db
    .prepare("DELETE FROM auth_attempts WHERE window_start < ? AND (locked_until IS NULL OR locked_until < ?)")
    .bind(now - 2 * 3_600_000, now)
    .run();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

/** Gives back a reservation that turned out to be legitimate (never lifts a lock that is already set). */
export async function release(db: D1, key: string): Promise<void> {
  await db
    .prepare("UPDATE auth_attempts SET count = MAX(count - 1, 0) WHERE key = ? AND locked_until IS NULL")
    .bind(key)
    .run();
}

/** Forgets a key entirely (a successful login resets that email's failures). */
export async function clear(db: D1, key: string): Promise<void> {
  await db.prepare("DELETE FROM auth_attempts WHERE key = ?").bind(key).run();
}
