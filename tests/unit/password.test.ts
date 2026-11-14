import { describe, expect, test } from "vitest";
import {
  constantTimeEqual,
  DUMMY_HASH,
  hashPassword,
  ITERATIONS,
  verifyPassword,
} from "../../src/worker/auth/password";
import { randomToken, sha256Hex, temporaryPassword } from "../../src/worker/auth/tokens";

describe("password hashing", () => {
  test("stores algorithm, 100000 iterations, salt and hash; salts differ", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).toMatch(/^pbkdf2-sha256\$100000\$[A-Za-z0-9+/=]{24}\$[A-Za-z0-9+/=]{44}$/);
    expect(ITERATIONS).toBe(100_000);
    expect(a).not.toBe(b);
    expect(a).not.toContain("correct horse");
  });
  test("verifies the right password and refuses a wrong one", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("correct horse batterz", h)).toBe(false);
  });
  test("refuses malformed or over-strong-claim hashes and never matches the dummy", async () => {
    for (const bad of [
      "",
      "x",
      "bcrypt$1$a$b",
      "pbkdf2-sha256$100000$$",
      "pbkdf2-sha256$999999999$AAAA$AAAA",
      "pbkdf2-sha256$abc$AAAA$AAAA",
    ]) {
      expect(await verifyPassword("anything", bad)).toBe(false);
    }
    expect(await verifyPassword("anything", DUMMY_HASH)).toBe(false);
    expect(await verifyPassword("anything", "pbkdf2-sha256$100000$!!!$@@@")).toBe(false);
  });
  test("constant-time compare handles different lengths", () => {
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(constantTimeEqual(new Uint8Array([1]), new Uint8Array([1, 0]))).toBe(false);
  });
});

describe("tokens", () => {
  test("session/invite tokens are 43 url-safe characters and unique", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });
  test("sha256 is the known hex digest", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  test("temporary passwords are 16 characters without look-alikes", () => {
    for (let i = 0; i < 20; i++) expect(temporaryPassword()).toMatch(/^[a-hj-km-np-zA-HJ-NP-Z2-9]{16}$/);
  });
});
