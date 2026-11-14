// Rate limits in D1 (table auth_attempts), checked before any hashing to save CPU. The rules and the arithmetic are in
// src/domain/auth.ts; this file only reads and writes the counters. Read-modify-write: two simultaneous failures can
// count once (accepted, TD-028).
import { type Attempts, type Limit, lockedForMs, recordFailure } from "../../domain/auth";
import type { D1 } from "../env";
import { sha256Hex } from "./tokens";

interface Row {
  window_start: number;
  count: number;
  locked_until: number | null;
}

export async function limitKey(kind: string, value: string): Promise<string> {
  return `${kind}:${await sha256Hex(value)}`;
}

async function load(db: D1, key: string): Promise<Attempts | null> {
  const row = await db
    .prepare("SELECT window_start, count, locked_until FROM auth_attempts WHERE key = ?")
    .bind(key)
    .first<Row>();
  return row ? { windowStart: row.window_start, count: row.count, lockedUntil: row.locked_until } : null;
}

/** Seconds a caller must wait, 0 when allowed. */
export async function retryAfterSeconds(db: D1, keys: string[], now: number): Promise<number> {
  let ms = 0;
  for (const key of keys) ms = Math.max(ms, lockedForMs(await load(db, key), now));
  return Math.ceil(ms / 1000);
}

/** Counts one attempt (a failure, or any attempt for sign-up) against a key. */
export async function count(db: D1, key: string, rule: Limit, now: number): Promise<void> {
  const next = recordFailure(await load(db, key), now, rule);
  await db
    .prepare(
      `INSERT INTO auth_attempts (key, window_start, count, locked_until) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = excluded.count,
         locked_until = excluded.locked_until`,
    )
    .bind(key, next.windowStart, next.count, next.lockedUntil)
    .run();
  // Housekeeping: counters whose window and lock are long over.
  await db
    .prepare("DELETE FROM auth_attempts WHERE window_start < ? AND (locked_until IS NULL OR locked_until < ?)")
    .bind(now - 2 * 3_600_000, now)
    .run();
}

export async function clear(db: D1, key: string): Promise<void> {
  await db.prepare("DELETE FROM auth_attempts WHERE key = ?").bind(key).run();
}
