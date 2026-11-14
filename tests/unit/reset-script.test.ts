import { expect, test } from "vitest";
// @ts-expect-error plain .mjs script without types
import { hashPassword, resetSql, temporaryPassword } from "../../scripts/reset-password.mjs";
import { verifyPassword } from "../../src/worker/auth/password";

test("the admin script writes hashes the Worker verifies", async () => {
  const pw = temporaryPassword();
  expect(pw).toMatch(/^[a-hj-km-np-zA-HJ-NP-Z2-9]{16}$/);
  const hash = hashPassword(pw);
  expect(await verifyPassword(pw, hash)).toBe(true);
  expect(await verifyPassword(`${pw}x`, hash)).toBe(false);
});

test("the reset SQL forces a change, ends sessions and escapes quotes", () => {
  const sql = resetSql("o'neil@example.test", "pbkdf2-sha256$100000$a$b");
  expect(sql).toContain("must_change_password = 1");
  expect(sql).toContain("DELETE FROM sessions");
  expect(sql).toContain("o''neil@example.test");
});
