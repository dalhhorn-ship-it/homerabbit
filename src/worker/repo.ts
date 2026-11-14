// The household-scoped repository: the only database access routes get (ADR 0013). `forHousehold` fixes the household
// id; every query binds it, and an id that belongs to another household finds nothing (the route answers 404).
import { INVITE_MS } from "../domain/auth";
import type { D1 } from "./env";

export interface Member {
  id: string;
  email: string;
  displayName: string;
}
export interface InviteInfo {
  id: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
}

export const MAX_OPEN_INVITES = 5;

export function forHousehold(db: D1, householdId: string) {
  const open = "household_id = ? AND used_at IS NULL AND expires_at > ?";
  return {
    async household(): Promise<{ id: string; name: string }> {
      const row = await db
        .prepare("SELECT id, name FROM households WHERE id = ?")
        .bind(householdId)
        .first<{ id: string; name: string }>();
      return row ?? { id: householdId, name: "" };
    },

    async rename(name: string): Promise<void> {
      await db.prepare("UPDATE households SET name = ? WHERE id = ?").bind(name, householdId).run();
    },

    async members(): Promise<Member[]> {
      const rows = await db
        .prepare("SELECT id, email, display_name FROM users WHERE household_id = ? ORDER BY created_at, email")
        .bind(householdId)
        .all<{ id: string; email: string; display_name: string }>();
      return rows.results.map((r) => ({ id: r.id, email: r.email, displayName: r.display_name }));
    },

    async member(id: string): Promise<Member | null> {
      const r = await db
        .prepare("SELECT id, email, display_name FROM users WHERE household_id = ? AND id = ?")
        .bind(householdId, id)
        .first<{ id: string; email: string; display_name: string }>();
      return r ? { id: r.id, email: r.email, displayName: r.display_name } : null;
    },

    /** One-time password: the member must choose a new one at next login and every session of theirs ends. */
    async setTemporaryPassword(memberId: string, hash: string): Promise<boolean> {
      const [update] = await db.batch([
        db
          .prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE household_id = ? AND id = ?")
          .bind(hash, householdId, memberId),
        db
          .prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE household_id = ? AND id = ?)")
          .bind(householdId, memberId),
      ]);
      return update.meta.changes === 1;
    },

    async openInvites(now: number): Promise<InviteInfo[]> {
      const rows = await db
        .prepare(`SELECT id, created_by, created_at, expires_at FROM invites WHERE ${open} ORDER BY created_at`)
        .bind(householdId, new Date(now).toISOString())
        .all<{ id: string; created_by: string; created_at: string; expires_at: string }>();
      return rows.results.map((r) => ({
        id: r.id,
        createdBy: r.created_by,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
      }));
    },

    /** Stores an invite (only the token's hash) unless MAX_OPEN_INVITES are already open; null then. */
    async createInvite(createdBy: string, tokenHash: string, now: number): Promise<InviteInfo | null> {
      const id = crypto.randomUUID();
      const createdAt = new Date(now).toISOString();
      const expiresAt = new Date(now + INVITE_MS).toISOString();
      const res = await db
        .prepare(
          `INSERT INTO invites (id, household_id, token_hash, created_by, created_at, expires_at)
           SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM invites WHERE ${open}) < ?`,
        )
        .bind(id, householdId, tokenHash, createdBy, createdAt, expiresAt, householdId, createdAt, MAX_OPEN_INVITES)
        .run();
      return res.meta.changes === 1 ? { id, createdBy, createdAt, expiresAt } : null;
    },

    async revokeInvite(id: string): Promise<boolean> {
      const res = await db
        .prepare("DELETE FROM invites WHERE household_id = ? AND id = ? AND used_at IS NULL")
        .bind(householdId, id)
        .run();
      return res.meta.changes === 1;
    },
  };
}

export type Repo = ReturnType<typeof forHousehold>;
