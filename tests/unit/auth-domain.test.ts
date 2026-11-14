import { describe, expect, test } from "vitest";
import {
  INVITE_MS,
  LOGIN_EMAIL,
  lockedForMs,
  normalizeEmail,
  recordFailure,
  SESSION_MS,
  sessionState,
  validateEmail,
  validatePassword,
} from "../../src/domain/auth";

const MIN = 60_000;
const DAY = 86_400_000;

describe("password rules", () => {
  test("accepts 10 to 128 characters, refuses 9 and 129", () => {
    expect(validatePassword("a1b2c3d4e5", "x@y.test")).toBeNull();
    expect(validatePassword("Zq-".padEnd(128, "k"), "x@y.test")).toBeNull();
    expect(validatePassword("a1b2c3d4e", "x@y.test")).toMatch(/at least 10/);
    expect(validatePassword("k".repeat(129), "x@y.test")).toMatch(/at most 128/);
  });
  test("refuses common passwords in any case and the email itself", () => {
    expect(validatePassword("Password123", "x@y.test")).toMatch(/too common/);
    expect(validatePassword("QWERTYUIOP", "x@y.test")).toMatch(/too common/);
    expect(validatePassword("Ab@Example.test", "ab@example.test")).toMatch(/email/);
  });
  test("has no composition rules", () => {
    expect(validatePassword("zzzzzzzzzzzq", "x@y.test")).toBeNull();
  });
});

describe("email", () => {
  test("is trimmed and lower-cased", () => expect(normalizeEmail("  Ab@Example.TEST ")).toBe("ab@example.test"));
  test("needs a plausible shape and a sane length", () => {
    expect(validateEmail("a@b.co")).toBe(true);
    for (const bad of ["", "a", "a@b", "a b@c.de", "@b.co", `${"a".repeat(250)}@b.co`])
      expect(validateEmail(bad)).toBe(false);
  });
});

describe("lockout", () => {
  const t0 = 1_000_000;
  test("locks on the fifth failure and unlocks after 15 minutes", () => {
    let s = null as ReturnType<typeof recordFailure> | null;
    for (let i = 0; i < 4; i++) {
      s = recordFailure(s, t0, LOGIN_EMAIL);
      expect(lockedForMs(s, t0)).toBe(0);
    }
    s = recordFailure(s, t0, LOGIN_EMAIL);
    expect(lockedForMs(s, t0)).toBe(15 * MIN);
    expect(lockedForMs(s, t0 + 14 * MIN)).toBe(MIN);
    expect(lockedForMs(s, t0 + 15 * MIN)).toBe(0);
  });
  test("the lock runs 15 minutes from the failure that caused it", () => {
    let s = null as ReturnType<typeof recordFailure> | null;
    for (let i = 0; i < 4; i++) s = recordFailure(s, t0 + i * MIN, LOGIN_EMAIL);
    s = recordFailure(s, t0 + 10 * MIN, LOGIN_EMAIL);
    expect(lockedForMs(s, t0 + 24 * MIN)).toBeGreaterThan(0);
    expect(lockedForMs(s, t0 + 25 * MIN)).toBe(0);
  });
  test("failures outside the window start counting again", () => {
    let s = recordFailure(null, t0, LOGIN_EMAIL);
    s = recordFailure(s, t0 + 20 * MIN, LOGIN_EMAIL);
    expect(s.count).toBe(1);
    expect(s.windowStart).toBe(t0 + 20 * MIN);
  });
  test("a finished lock starts a new window", () => {
    let s = null as ReturnType<typeof recordFailure> | null;
    for (let i = 0; i < 5; i++) s = recordFailure(s, t0, LOGIN_EMAIL);
    s = recordFailure(s, t0 + 16 * MIN, LOGIN_EMAIL);
    expect(s.count).toBe(1);
    expect(s.lockedUntil).toBeNull();
  });
  test("no state means not locked", () => expect(lockedForMs(null, t0)).toBe(0));
});

describe("session and invite time", () => {
  const issued = 5_000_000;
  const expires = issued + SESSION_MS;
  test("lasts 90 days, renewed with use", () => {
    expect(SESSION_MS).toBe(90 * DAY);
    expect(sessionState(expires, issued + 89 * DAY)).toBe("renew");
    expect(sessionState(expires, expires)).toBe("expired");
    expect(sessionState(expires, expires + DAY)).toBe("expired");
  });
  test("renews once more than a day of the lifetime is used", () => {
    expect(sessionState(expires, issued + 10 * MIN)).toBe("valid");
    expect(sessionState(expires, issued + DAY + MIN)).toBe("renew");
  });
  test("invites last 7 days", () => expect(INVITE_MS).toBe(7 * DAY));
});
