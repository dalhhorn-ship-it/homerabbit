// Criteria 1-4 of docs/specs/accounts-and-households.md: sign-up, sessions, generic errors, lockout.
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  Client,
  createWorld,
  DAY,
  homeName,
  is2xx,
  isRefusal,
  login,
  newPerson,
  SESSION_COOKIE,
  signUp,
  startClock,
  strongPw,
  uniqueEmail,
  type World,
} from "./helpers";

let w: World;
beforeAll(async () => {
  w = await createWorld();
});
afterAll(async () => {
  await w?.close();
});
afterEach(() => {
  vi.useRealTimers();
});

test("test_c1_signup_creates_account_household_and_session", async () => {
  const client = new Client(w);
  const email = uniqueEmail("c1");
  const res = await signUp(client, email, strongPw());
  expect(is2xx(res), `sign-up status ${res.status}: ${res.text}`).toBe(true);
  expect(client.hasSession(), `cookie ${SESSION_COOKIE} must be set`).toBe(true);
  const me = await client.get("/api/me");
  expect(me.status).toBe(200);
  expect(me.text).toContain(homeName(email));
  expect(me.text).toContain(email);
});

test("test_c1_password_of_exactly_ten_characters_is_accepted", async () => {
  const client = new Client(w);
  const email = uniqueEmail("c1ten");
  const pw = `Kx${Math.random().toString(36).slice(2, 10)}`.slice(0, 10).padEnd(10, "q");
  expect(pw.length).toBe(10);
  const res = await signUp(client, email, pw);
  expect(is2xx(res), `status ${res.status}: ${res.text}`).toBe(true);
  expect(client.hasSession()).toBe(true);
});

test("test_c1_password_shorter_than_ten_is_refused_with_a_message", async () => {
  const client = new Client(w);
  const email = uniqueEmail("c1short");
  const short = "Kx9".padEnd(9, "q");
  expect(short.length).toBe(9);
  const res = await signUp(client, email, short);
  expect(isRefusal(res), `expected a 4xx refusal, got ${res.status}`).toBe(true);
  expect(res.text.trim().length).toBeGreaterThan(0);
  expect(client.hasSession()).toBe(false);
  // No account was created: the short password cannot log in, and a retry with a valid one works.
  const probe = new Client(w);
  expect(is2xx(await login(probe, email, short))).toBe(false);
  expect(is2xx(await signUp(new Client(w), email, strongPw()))).toBe(true);
});

test("test_c2_session_lasts_90_days_since_last_use", async () => {
  const clock = startClock();
  const p = await newPerson(w, "c2slide");
  const device = new Client(w);
  const lg = await login(device, p.email, p.pw);
  expect(is2xx(lg), `login status ${lg.status}`).toBe(true);
  expect(device.hasSession()).toBe(true);

  clock.advance(60 * DAY);
  expect((await device.get("/api/me")).status, "day 60 since login").toBe(200);
  clock.advance(60 * DAY); // 120 days after login, 60 since last use
  expect((await device.get("/api/me")).status, "60 days since last use").toBe(200);
  clock.advance(89 * DAY);
  expect((await device.get("/api/me")).status, "89 days since last use").toBe(200);
  clock.advance(91 * DAY);
  expect((await device.get("/api/me")).status, "91 days since last use").toBe(401);
});

test("test_c2_unused_session_expires_after_90_days", async () => {
  const clock = startClock();
  const p = await newPerson(w, "c2idle");
  const device = new Client(w);
  expect(is2xx(await login(device, p.email, p.pw))).toBe(true);
  clock.advance(91 * DAY);
  expect((await device.get("/api/me")).status).toBe(401);
});

test("test_c2_logout_ends_this_device_only", async () => {
  const p = await newPerson(w, "c2out");
  const phone = new Client(w);
  const ipad = new Client(w);
  expect(is2xx(await login(phone, p.email, p.pw))).toBe(true);
  expect(is2xx(await login(ipad, p.email, p.pw))).toBe(true);
  const stolen = phone.cloneCookies();

  const out = await phone.post("/api/auth/logout", {});
  expect(is2xx(out), `logout status ${out.status}`).toBe(true);
  expect((await phone.get("/api/me")).status, "phone after logout").toBe(401);
  expect((await stolen.get("/api/me")).status, "replayed cookie after logout").toBe(401);
  expect((await ipad.get("/api/me")).status, "other device stays logged in").toBe(200);
  expect((await p.client.get("/api/me")).status, "sign-up device stays logged in").toBe(200);
});

test("test_c3_wrong_password_and_unknown_email_are_indistinguishable", async () => {
  const p = await newPerson(w, "c3");
  const wrongPw = await login(new Client(w), p.email, strongPw());
  const unknown = await login(new Client(w), uniqueEmail("c3none"), strongPw());
  expect(isRefusal(wrongPw), `wrong password status ${wrongPw.status}`).toBe(true);
  expect(isRefusal(unknown), `unknown email status ${unknown.status}`).toBe(true);
  expect(unknown.status).toBe(wrongPw.status);
  expect(unknown.text).toBe(wrongPw.text);
  expect(wrongPw.text).toMatch(/email or password is wrong/i);
  expect(wrongPw.headers.getSetCookie().length).toBe(0);
  expect(unknown.headers.getSetCookie().length).toBe(0);
});

test("test_c3_signup_with_existing_email_is_refused_and_changes_nothing", async () => {
  // The wording of this refusal is an open question (tests/acceptance/manifest.json); only the behaviour is checked.
  const p = await newPerson(w, "c3dup");
  const intruder = new Client(w);
  const res = await signUp(intruder, p.email, strongPw());
  expect(isRefusal(res), `status ${res.status}`).toBe(true);
  expect(intruder.hasSession()).toBe(false);
  // The original account still works with its own password.
  expect(is2xx(await login(new Client(w), p.email, p.pw))).toBe(true);
});

test("test_c4_five_failures_lock_the_email_even_for_the_right_password", async () => {
  const p = await newPerson(w, "c4");
  for (let i = 0; i < 5; i++) {
    const bad = await login(new Client(w), p.email, strongPw()); // a fresh source address each time
    expect(isRefusal(bad), `failure ${i + 1} status ${bad.status}`).toBe(true);
  }
  const locked = new Client(w);
  const res = await login(locked, p.email, p.pw);
  expect(res.status).toBe(429);
  expect(res.headers.get("Retry-After")).toBeTruthy();
  expect(res.text).toMatch(/try again later/i);
  expect(locked.hasSession()).toBe(false);
});

test("test_c4_four_failures_do_not_lock", async () => {
  const p = await newPerson(w, "c4four");
  for (let i = 0; i < 4; i++) {
    expect(isRefusal(await login(new Client(w), p.email, strongPw()))).toBe(true);
  }
  expect(is2xx(await login(new Client(w), p.email, p.pw))).toBe(true);
});

test("test_c4_lockout_of_one_email_does_not_affect_another", async () => {
  const a = await newPerson(w, "c4a");
  const b = await newPerson(w, "c4b");
  for (let i = 0; i < 6; i++) await login(new Client(w), a.email, strongPw());
  expect(is2xx(await login(new Client(w), b.email, b.pw))).toBe(true);
});
