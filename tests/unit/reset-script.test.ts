import { createHash } from "node:crypto";
import { expect, test } from "vitest";
// @ts-expect-error plain .mjs script without types
import { hashPassword, parseTarget, resetSql, temporaryPassword } from "../../scripts/reset-password.mjs";
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

test("the reset SQL clears the email's login lockout under the Worker's key", async () => {
  const { limitKey } = await import("../../src/worker/auth/limits");
  const sql = resetSql("a@example.test", "pbkdf2-sha256$100000$a$b");
  expect(sql).toContain(`DELETE FROM auth_attempts WHERE key = '${await limitKey("login-email", "a@example.test")}'`);
  expect(createHash("sha256").update("a@example.test").digest("hex")).toHaveLength(64);
});

test("the script needs an explicit target and refuses otherwise", () => {
  expect(parseTarget(["a@example.test"])).toBeNull();
  expect(parseTarget(["a@example.test", "--database", "homerabbit"])).toBeNull();
  expect(parseTarget(["a@example.test", "--remote"])).toBeNull();
  expect(parseTarget(["a@example.test", "--remote", "--database"])).toBeNull();
  expect(parseTarget(["a@example.test", "--local", "--remote", "--database", "x"])).toBeNull();
  expect(parseTarget(["a@example.test", "--local"])).toEqual({ local: true, database: "homerabbit" });
  expect(parseTarget(["a@example.test", "--remote", "--database", "homerabbit-preview"])).toEqual({
    local: false,
    database: "homerabbit-preview",
  });
});

test("run without a target the script exits 2 and touches nothing", async () => {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync("node", ["scripts/reset-password.mjs", "a@example.test"], { encoding: "utf8" });
  expect(r.status).toBe(2);
  expect(r.stderr).toContain("--local | --remote --database");
});
