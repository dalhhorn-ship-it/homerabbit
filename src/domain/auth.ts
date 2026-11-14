// Pure account logic (ADR 0013): password and email rules, lockout state, session and invite timing.
// No I/O and no clock: callers pass `now` in epoch milliseconds so every rule is testable.
import { COMMON_PASSWORDS } from "./common-passwords";

const MIN = 60_000;
const DAY = 86_400_000;

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const SESSION_MS = 90 * DAY;
export const INVITE_MS = 7 * DAY;
/** A session is renewed on use once more than this much of its lifetime is gone (saves a write per request). */
const RENEW_AFTER_MS = DAY;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/** null when fine, else a message safe to show. Length 10..128, no composition rules, no common passwords, not the email. */
export function validatePassword(password: string, email: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "That password is too common. Choose another.";
  if (password.toLowerCase() === normalizeEmail(email)) return "Password must not be your email address.";
  return null;
}

export interface Limit {
  limit: number;
  windowMs: number;
  lockMs: number;
}
export interface Attempts {
  windowStart: number;
  count: number;
  lockedUntil: number | null;
}

export const LOGIN_EMAIL: Limit = { limit: 5, windowMs: 15 * MIN, lockMs: 15 * MIN };
export const LOGIN_SOURCE: Limit = { limit: 50, windowMs: 15 * MIN, lockMs: 15 * MIN };
export const SIGNUP_SOURCE: Limit = { limit: 5, windowMs: 60 * MIN, lockMs: 60 * MIN };
export const ACCOUNT_SOURCE: Limit = { limit: 10, windowMs: 15 * MIN, lockMs: 15 * MIN };

/** Milliseconds left on a lock, 0 when not locked. */
export function lockedForMs(state: Attempts | null, now: number): number {
  if (!state || state.lockedUntil === null) return 0;
  return Math.max(0, state.lockedUntil - now);
}

/** The state after one more counted attempt: a finished lock or window starts over; reaching the limit locks. */
export function recordFailure(state: Attempts | null, now: number, rule: Limit): Attempts {
  let s = state;
  if (s && s.lockedUntil !== null && s.lockedUntil <= now) s = null;
  if (s && s.lockedUntil === null && now - s.windowStart >= rule.windowMs) s = null;
  const count = (s?.count ?? 0) + 1;
  const windowStart = s?.windowStart ?? now;
  const lockedUntil = s?.lockedUntil ?? (count >= rule.limit ? now + rule.lockMs : null);
  return { windowStart, count, lockedUntil };
}

export type SessionState = "valid" | "renew" | "expired";

export function sessionState(expiresAt: number, now: number): SessionState {
  if (expiresAt <= now) return "expired";
  return SESSION_MS - (expiresAt - now) > RENEW_AFTER_MS ? "renew" : "valid";
}
