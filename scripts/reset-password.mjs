#!/usr/bin/env node
// Admin password reset without email (HR-1, ADR 0013): sets a random temporary password, forces a new one at the
// next login and ends the account's sessions. Runs against the Cloudflare D1 database with YOUR credentials
// (`wrangler login`); the Worker needs no admin endpoint.
//   node scripts/reset-password.mjs <email> --local
//   node scripts/reset-password.mjs <email> --remote --database <name>     (homerabbit or homerabbit-preview)
// The target must be named: with neither --local nor --remote --database the script refuses, so a reset never lands on
// production by default. It also clears the email's login lockout counters.
// Hash format and parameters are the Worker's (src/worker/auth/password.ts): pbkdf2-sha256$100000$salt$hash.
import { execFileSync } from "node:child_process";
import { createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const ITERATIONS = 100_000;
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function temporaryPassword() {
  let out = "";
  const limit = 256 - (256 % ALPHABET.length);
  while (out.length < 16) {
    for (const b of randomBytes(32)) if (b < limit && out.length < 16) out += ALPHABET[b % ALPHABET.length];
  }
  return out;
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  return `pbkdf2-sha256$${ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** Matches the Worker's limitKey("login-email", email): the lowercase hex SHA-256 of the normalized email. */
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");

export function resetSql(email, hash) {
  const e = email.replaceAll("'", "''");
  return [
    `UPDATE users SET password_hash = '${hash}', must_change_password = 1 WHERE email = '${e}'`,
    `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = '${e}')`,
    `DELETE FROM auth_attempts WHERE key = 'login-email:${sha256Hex(email)}'`,
  ].join("; ");
}

function d1(command, database, local) {
  const where = local ? "--local" : "--remote";
  const out = execFileSync("npx", ["wrangler", "d1", "execute", database, where, "--json", "--command", command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(out);
}

const USAGE = "usage: node scripts/reset-password.mjs <email> (--local | --remote --database <name>)";

/** The explicit target, or null when the arguments do not name one. */
export function parseTarget(argv) {
  const local = argv.includes("--local");
  const remote = argv.includes("--remote");
  const di = argv.indexOf("--database");
  const database = di >= 0 ? argv[di + 1] : undefined;
  if (local === remote) return null; // neither, or both
  if (local) return { local: true, database: database && !database.startsWith("--") ? database : "homerabbit" };
  if (!database || database.startsWith("--")) return null;
  return { local: false, database };
}

function main(argv) {
  const target = parseTarget(argv);
  const email = argv
    .find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--database")
    ?.trim()
    .toLowerCase();
  if (!target || !email || !/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(email)) {
    console.error(USAGE);
    process.exit(2);
  }
  const { local, database } = target;
  const found = d1(`SELECT id FROM users WHERE email = '${email}'`, database, local);
  if (!found[0]?.results?.length) {
    console.error(`No account with email ${email} in ${database}.`);
    process.exit(1);
  }
  const password = temporaryPassword();
  d1(resetSql(email, hashPassword(password)), database, local);
  console.log(`Temporary password for ${email} (shown once; share it privately):\n\n  ${password}\n`);
  console.log("They must choose a new password at next login; their other sessions have ended.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
