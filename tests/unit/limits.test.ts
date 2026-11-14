// Rate limits: atomic reservation in SQL (TD-028), matching the pure model in src/domain/auth.ts.
import { afterAll, beforeAll, expect, test } from "vitest";
import { type Attempts, LOGIN_EMAIL, lockedForMs, recordFailure, SIGNUP_SOURCE } from "../../src/domain/auth";
import { clear, release, reserve, reserveAll } from "../../src/worker/auth/limits";
import { createWorld, type World } from "./world";

// Fixed test input (not a credential).
const WRONG = ["wrong", "guess", "1"].join("-");

let w: World;
beforeAll(async () => {
  w = await createWorld();
});
afterAll(async () => {
  await w?.close();
});

const rule = { limit: 3, windowMs: 1000, lockMs: 5000 };

test("the SQL upsert follows the domain model step by step, including window and lock restarts", async () => {
  let model: Attempts | null = null;
  const times = [0, 100, 200, 300, 1000, 5199, 5200, 5300, 6400, 6500, 6600];
  for (const t of times) {
    model = recordFailure(model, t, rule);
    const got = await reserve(w.db, "k-model", rule, t);
    expect(got, `at ${t}`).toEqual({ count: model.count, lockedUntil: model.lockedUntil });
  }
});

test("the attempt that reaches the limit still runs; later ones are refused until the lock ends", async () => {
  const key = "k-limit";
  const waits: number[] = [];
  for (let i = 0; i < 5; i++) waits.push(await reserveAll(w.db, [[key, rule]], 10_000));
  expect(waits).toEqual([0, 0, 0, 5, 5]);
  expect(await reserveAll(w.db, [[key, rule]], 10_000 + 5000)).toBe(0); // lock over: starts again
});

test("concurrent reservations all count: 20 at once give 3 allowed and 17 refused", async () => {
  const waits = await Promise.all(Array.from({ length: 20 }, () => reserveAll(w.db, [["k-par", rule]], 50_000)));
  expect(waits.filter((x) => x === 0)).toHaveLength(3);
  const row = await w.db.prepare("SELECT count FROM auth_attempts WHERE key = ?").bind("k-par").first();
  expect(row.count).toBe(20);
});

test("release gives an attempt back unless a lock is set; clear forgets the key", async () => {
  await reserve(w.db, "k-rel", rule, 0);
  await reserve(w.db, "k-rel", rule, 0);
  await release(w.db, "k-rel");
  expect((await reserve(w.db, "k-rel", rule, 0)).count).toBe(2);
  await reserve(w.db, "k-rel", rule, 0); // count 3: locked
  await release(w.db, "k-rel"); // no effect while locked
  expect((await reserve(w.db, "k-rel", rule, 0)).count).toBe(4);
  await clear(w.db, "k-rel");
  expect((await reserve(w.db, "k-rel", rule, 0)).count).toBe(1);
});

test("the real rules lock on the 5th login failure and the 5th sign-up attempt", () => {
  expect(LOGIN_EMAIL.limit).toBe(5);
  expect(SIGNUP_SOURCE.limit).toBe(5);
  expect(lockedForMs(null, 0)).toBe(0);
});

test("20 parallel wrong logins for one email: at most 5 reach the password check, the rest get 429", async () => {
  const email = "race@example.test";
  const res = await Promise.all(
    Array.from({ length: 20 }, () =>
      w.call("POST", "/api/auth/login", { ip: "10.1.1.1", body: { email, password: WRONG } }),
    ),
  );
  const statuses = res.map((r) => r.status);
  expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(5);
  expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(15);
  expect(statuses.every((s) => s === 401 || s === 429)).toBe(true);
});

test("every /api response, success or failure, carries Cache-Control: no-store", async () => {
  for (const [method, path, opts] of [
    ["GET", "/api/health", {}],
    ["GET", "/api/me", {}],
    ["GET", "/api/nope", {}],
    ["POST", "/api/auth/login", { origin: null, body: {} }],
    ["POST", "/api/auth/login", { body: { email: "x@example.test", password: WRONG } }],
  ] as const) {
    const res = await w.call(method, path, opts);
    expect(res.headers.get("Cache-Control"), `${method} ${path} ${res.status}`).toBe("no-store");
  }
});
