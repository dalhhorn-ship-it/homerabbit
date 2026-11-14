// Account use cases: sign-up, login, logout, sessions, password change and reset, invite acceptance.
// Routes call these through `c.get("auth")`; results are plain data, the routes turn them into HTTP.
import {
  ACCOUNT_SOURCE,
  LOGIN_EMAIL,
  LOGIN_SOURCE,
  normalizeEmail,
  SESSION_MS,
  SIGNUP_SOURCE,
  sessionState,
  validateEmail,
  validatePassword,
} from "../../domain/auth";
import type { D1, Session } from "../env";
import type { Repo } from "../repo";
import * as limits from "./limits";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password";
import * as store from "./store";
import { randomToken, sha256Hex, temporaryPassword } from "./tokens";

export const MSG = {
  signup: "Could not create account.",
  login: "Email or password is wrong.",
  limited: "Too many attempts, try again later.",
  invite: "This invite link is not valid.",
  mustChange: "Choose a new password first.",
};

export type Failure = { ok: false; status: 400 | 401 | 403 | 404 | 409 | 429; error: string; retryAfter?: number };
const fail = (status: Failure["status"], error: string, retryAfter?: number): Failure => ({
  ok: false,
  status,
  error,
  retryAfter,
});

export interface Identified {
  ok: true;
  token: string;
  userId: string;
  mustChangePassword: boolean;
}
export interface Resolved {
  session: Session;
  /** Set when the cookie should be re-issued with a fresh 90 days. */
  renewed: boolean;
}

const iso = (ms: number) => new Date(ms).toISOString();

export function createAuthService(db: D1) {
  async function startSession(userId: string): Promise<string> {
    const token = randomToken();
    const now = Date.now();
    await store.deleteExpiredSessions(db, userId, iso(now));
    await store.createSession(db, await sha256Hex(token), userId, iso(now), iso(now + SESSION_MS));
    return token;
  }

  /** Reserves one attempt on each key (one atomic upsert per key) before any hashing; a 429 when one is locked. */
  async function reserve(reservations: limits.Reservation[]): Promise<Failure | null> {
    const wait = await limits.reserveAll(db, reservations, Date.now());
    return wait > 0 ? fail(429, MSG.limited, wait) : null;
  }

  return {
    async signup(input: {
      email: unknown;
      password: unknown;
      displayName: unknown;
      inviteToken: unknown;
      ip: string;
    }): Promise<Identified | Failure> {
      const ipKey = await limits.limitKey("signup", input.ip);
      const limited = await reserve([[ipKey, SIGNUP_SOURCE]]);
      if (limited) return limited;

      if (typeof input.email !== "string" || typeof input.password !== "string") return fail(400, MSG.signup);
      const email = normalizeEmail(input.email);
      if (!validateEmail(email)) return fail(400, MSG.signup);
      const problem = validatePassword(input.password, email);
      if (problem) return fail(400, problem);
      const name = typeof input.displayName === "string" ? input.displayName.trim().slice(0, 60) : "";
      const invite = input.inviteToken;
      if (invite !== undefined && invite !== null && (typeof invite !== "string" || invite.length > 200)) {
        return fail(400, MSG.signup);
      }

      // Hash first in every case, so a duplicate email or a bad invite costs the same time as a success.
      const hash = await hashPassword(input.password);
      const row = {
        userId: crypto.randomUUID(),
        email,
        displayName: name || email.split("@")[0],
        hash,
        now: iso(Date.now()),
      };
      try {
        if (typeof invite === "string" && invite) {
          if (!(await store.insertUserViaInvite(db, { ...row, tokenHash: await sha256Hex(invite) }))) {
            return fail(400, MSG.signup);
          }
        } else {
          await store.insertHouseholdAndUser(db, { ...row, householdId: crypto.randomUUID() });
        }
      } catch {
        return fail(400, MSG.signup); // duplicate email: same status and body as every other sign-up failure
      }
      return { ok: true, token: await startSession(row.userId), userId: row.userId, mustChangePassword: false };
    },

    async login(input: { email: unknown; password: unknown; ip: string }): Promise<Identified | Failure> {
      const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
      const password = typeof input.password === "string" ? input.password : "";
      const keys = [await limits.limitKey("login-email", email), await limits.limitKey("login-ip", input.ip)];
      const limited = await reserve([
        [keys[0], LOGIN_EMAIL],
        [keys[1], LOGIN_SOURCE],
      ]);
      if (limited) return limited;

      const user = email ? await store.findUserByEmail(db, email) : null;
      const good = await verifyPassword(password.slice(0, 1024), user?.password_hash ?? DUMMY_HASH);
      if (!user || !good) return fail(401, MSG.login); // the attempt is already counted
      await limits.clear(db, keys[0]);
      // keys[1] (per source) is NOT released on success: a throwaway account could otherwise reset it (review HR-1)
      return {
        ok: true,
        token: await startSession(user.id),
        userId: user.id,
        mustChangePassword: user.must_change_password === 1,
      };
    },

    async logout(token: string) {
      await store.deleteSession(db, await sha256Hex(token));
    },

    /** The session behind a cookie token, renewing it when it has been used for a while; null when none or expired. */
    async resolve(token: string): Promise<Resolved | null> {
      const hash = await sha256Hex(token);
      const row = await store.findSession(db, hash);
      if (!row) return null;
      const now = Date.now();
      const state = sessionState(Date.parse(row.expires_at), now);
      if (state === "expired") {
        await store.deleteSession(db, hash);
        return null;
      }
      if (state === "renew") await store.renewSession(db, hash, iso(now + SESSION_MS));
      return {
        renewed: state === "renew",
        session: {
          userId: row.user_id,
          householdId: row.household_id,
          mustChangePassword: row.must_change_password === 1,
        },
      };
    },

    async changePassword(input: {
      userId: string;
      current: unknown;
      next: unknown;
      ip: string;
    }): Promise<Identified | Failure> {
      const ipKey = await limits.limitKey("account-ip", input.ip);
      const limited = await reserve([[ipKey, ACCOUNT_SOURCE]]);
      if (limited) return limited;
      const user = await store.findUserById(db, input.userId);
      if (!user || typeof input.current !== "string" || typeof input.next !== "string")
        return fail(400, "Invalid request.");
      if (!(await verifyPassword(input.current.slice(0, 1024), user.password_hash))) {
        return fail(403, "Current password is wrong.");
      }
      await limits.release(db, ipKey);
      const problem = validatePassword(input.next, user.email);
      if (problem) return fail(400, problem);
      if (input.next === input.current) return fail(400, "Choose a password you have not used just now.");
      await store.replacePassword(db, user.id, await hashPassword(input.next));
      return { ok: true, token: await startSession(user.id), userId: user.id, mustChangePassword: false };
    },

    /** Another member of the caller's household gets a one-time temporary password; their sessions end. */
    async resetMemberPassword(
      repo: Repo,
      actorId: string,
      targetId: string,
    ): Promise<{ ok: true; password: string } | Failure> {
      const target = await repo.member(targetId);
      if (!target) return fail(404, "Not found.");
      if (target.id === actorId) return fail(400, "Use change password for your own account.");
      const password = temporaryPassword();
      await repo.setTemporaryPassword(target.id, await hashPassword(password));
      return { ok: true, password };
    },

    async acceptInvite(input: { userId: string; token: unknown; ip: string }): Promise<{ ok: true } | Failure> {
      const ipKey = await limits.limitKey("account-ip", input.ip);
      const limited = await reserve([[ipKey, ACCOUNT_SOURCE]]);
      if (limited) return limited;
      const token = typeof input.token === "string" && input.token.length <= 200 ? input.token : "";
      const result = token
        ? await store.acceptInvite(db, input.userId, await sha256Hex(token), iso(Date.now()))
        : "invalid";
      if (result === "invalid") return fail(400, MSG.invite);
      await limits.release(db, ipKey);
      if (result === "conflict") {
        return fail(
          409,
          "You already have data in your own household or share it with others, so you cannot join another.",
        );
      }
      return { ok: true };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
