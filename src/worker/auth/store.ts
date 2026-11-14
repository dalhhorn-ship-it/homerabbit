// SQL for accounts that exist before a household is known (sign-up, login, sessions, invite acceptance).
// Everything that runs for a signed-in member inside a household lives in ../repo.ts instead.
import type { D1 } from "../env";

export interface UserRow {
  id: string;
  household_id: string;
  email: string;
  display_name: string;
  password_hash: string;
  must_change_password: number;
}

export interface SessionRow {
  expires_at: string;
  user_id: string;
  household_id: string;
  must_change_password: number;
}

export async function findUserByEmail(db: D1, email: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
}

export async function findUserById(db: D1, id: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
}

interface NewUser {
  userId: string;
  email: string;
  displayName: string;
  hash: string;
  now: string;
}

/** A new household "<email>'s home" and its first member, in one transaction. Throws on a duplicate email. */
export async function insertHouseholdAndUser(db: D1, u: NewUser & { householdId: string }): Promise<void> {
  await db.batch([
    db
      .prepare("INSERT INTO households (id, name, created_at) VALUES (?, ?, ?)")
      .bind(u.householdId, `${u.email}'s home`, u.now),
    db
      .prepare(
        "INSERT INTO users (id, household_id, email, display_name, password_hash, must_change_password, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
      )
      .bind(u.userId, u.householdId, u.email, u.displayName, u.hash, u.now),
  ]);
}

/** A new member of the household the invite belongs to; the invite is spent in the same transaction.
 * False when the invite is unknown, used or expired (nothing written). Throws on a duplicate email. */
export async function insertUserViaInvite(db: D1, u: NewUser & { tokenHash: string }): Promise<boolean> {
  const [insert] = await db.batch([
    db
      .prepare(
        `INSERT INTO users (id, household_id, email, display_name, password_hash, must_change_password, created_at)
         SELECT ?, i.household_id, ?, ?, ?, 0, ? FROM invites i
         WHERE i.token_hash = ? AND i.used_at IS NULL AND i.expires_at > ?`,
      )
      .bind(u.userId, u.email, u.displayName, u.hash, u.now, u.tokenHash, u.now),
    db
      .prepare(
        `UPDATE invites SET used_at = ?, used_by = ?
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? AND EXISTS (SELECT 1 FROM users WHERE id = ?)`,
      )
      .bind(u.now, u.userId, u.tokenHash, u.now, u.userId),
  ]);
  return insert.meta.changes === 1;
}

export async function createSession(db: D1, tokenHash: string, userId: string, now: string, expires: string) {
  await db
    .prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(tokenHash, userId, now, expires)
    .run();
}

export async function findSession(db: D1, tokenHash: string): Promise<SessionRow | null> {
  return db
    .prepare(
      `SELECT s.expires_at, s.user_id, u.household_id, u.must_change_password
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .bind(tokenHash)
    .first<SessionRow>();
}

export async function renewSession(db: D1, tokenHash: string, expires: string) {
  await db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").bind(expires, tokenHash).run();
}

export async function deleteSession(db: D1, tokenHash: string) {
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function deleteExpiredSessions(db: D1, userId: string, now: string) {
  await db.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?").bind(userId, now).run();
}

/** Sets a new password hash, clears the must-change flag and ends every session of the user. */
export async function replacePassword(db: D1, userId: string, hash: string) {
  await db.batch([
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").bind(hash, userId),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
  ]);
}

// Tables that hold a household's own data once their features exist (HR-8 rooms, HR-2 items). Checked by name at run
// time because those migrations come later (TD-029).
const DATA_TABLES = ["rooms", "items"];

async function householdHasData(db: D1, householdId: string): Promise<boolean> {
  for (const table of DATA_TABLES) {
    const exists = await db
      .prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?")
      .bind(table)
      .first();
    if (!exists) continue;
    const row = await db
      .prepare(`SELECT 1 AS x FROM ${table} WHERE household_id = ? LIMIT 1`)
      .bind(householdId)
      .first();
    if (row) return true;
  }
  return false;
}

export type AcceptResult = "joined" | "invalid" | "conflict";

/** Moves a signed-in user into the household of an invite. The invite is checked first (generic "invalid"), then the
 * user's own household must hold only them and no data (else "conflict"); their empty household is then deleted. */
export async function acceptInvite(db: D1, userId: string, tokenHash: string, now: string): Promise<AcceptResult> {
  const invite = await db
    .prepare("SELECT id, household_id FROM invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
    .bind(tokenHash, now)
    .first<{ id: string; household_id: string }>();
  const user = await findUserById(db, userId);
  if (!invite || !user || invite.household_id === user.household_id) return "invalid";
  const members = await db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE household_id = ?")
    .bind(user.household_id)
    .first<{ n: number }>();
  if ((members?.n ?? 0) > 1 || (await householdHasData(db, user.household_id))) return "conflict";
  const old = user.household_id;
  const [spend] = await db.batch([
    db
      .prepare("UPDATE invites SET used_at = ?, used_by = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?")
      .bind(now, userId, invite.id, now),
    db
      .prepare(
        "UPDATE users SET household_id = ? WHERE id = ? AND EXISTS (SELECT 1 FROM invites WHERE id = ? AND used_by = ?)",
      )
      .bind(invite.household_id, userId, invite.id, userId),
    db
      .prepare("DELETE FROM invites WHERE household_id = ? AND NOT EXISTS (SELECT 1 FROM users WHERE household_id = ?)")
      .bind(old, old),
    db
      .prepare("DELETE FROM households WHERE id = ? AND NOT EXISTS (SELECT 1 FROM users WHERE household_id = ?)")
      .bind(old, old),
  ]);
  return spend.meta.changes === 1 ? "joined" : "invalid";
}
