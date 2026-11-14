// Worker behaviour beyond the acceptance suite: validation, CSRF, session edge cases, invite and reset rules.
import { afterAll, beforeAll, expect, test } from "vitest";
import { MAX_OPEN_INVITES } from "../../src/worker/repo";
import { cookieOf, createWorld, type World } from "./world";

let w: World;
beforeAll(async () => {
  w = await createWorld();
});
afterAll(async () => {
  await w?.close();
});

let n = 0;
const email = () => `u${++n}-${Math.random().toString(36).slice(2, 8)}@example.test`;
const pw = () => `Zq${Math.random().toString(36).slice(2, 12)}-${n}`;

async function signUp(extra: Record<string, unknown> = {}) {
  const e = email();
  const p = pw();
  const res = await w.call("POST", "/api/auth/signup", {
    body: { email: e, password: p, displayName: "Pat", ...extra },
  });
  return { e, p, res, cookie: cookieOf(res) };
}
const me = async (cookie: string) => (await w.call("GET", "/api/me", { cookie })).json() as Promise<any>;

test("health is public and needs no cookie", async () => {
  expect((await w.call("GET", "/api/health", { origin: null })).status).toBe(200);
});

test("state-changing requests need the app's own Origin", async () => {
  const body = { email: email(), password: pw(), displayName: "x" };
  expect((await w.call("POST", "/api/auth/signup", { body, origin: null })).status).toBe(403);
  expect((await w.call("POST", "/api/auth/signup", { body, origin: "https://evil.example" })).status).toBe(403);
  expect((await w.call("POST", "/api/auth/signup", { body })).status).toBe(201);
});

test("the session cookie is __Host-, HttpOnly, Secure, Lax, Path=/ and 90 days", async () => {
  const { res } = await signUp();
  const line = res.headers.getSetCookie()[0];
  expect(line).toMatch(/^__Host-hr_session=[A-Za-z0-9_-]{43};/);
  for (const part of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", `Max-Age=${90 * 86400}`])
    expect(line).toContain(part);
  expect(line).not.toMatch(/Domain=/i);
});

test("unknown paths and bad cookies answer 401 without a hint", async () => {
  expect((await w.call("GET", "/api/rooms/abc")).status).toBe(401);
  const res = await w.call("GET", "/api/me", { cookie: "__Host-hr_session=nope" });
  expect(res.status).toBe(401);
  expect(res.headers.getSetCookie().join()).toContain("Max-Age=0");
});

test("sign-up validation: bad email, missing fields, odd bodies all give the generic failure", async () => {
  const bodies: unknown[] = [
    { email: "nope", password: pw() },
    { email: email() },
    { password: pw() },
    { email: email(), password: pw(), inviteToken: 5 },
    {},
  ];
  const seen = new Set<string>();
  for (const body of bodies) {
    const res = await w.call("POST", "/api/auth/signup", { body });
    expect(res.status).toBe(400);
    seen.add(await res.text());
  }
  expect(seen.size).toBe(1);
  expect([...seen][0]).toContain("Could not create account");
});

test("sign-up refuses common passwords and the email as password, with a clear message", async () => {
  const common = await w.call("POST", "/api/auth/signup", { body: { email: email(), password: "Password123" } });
  expect(common.status).toBe(400);
  expect(await common.text()).toContain("too common");
  const e = `${Math.random().toString(36).slice(2)}@example.test`;
  const same = await w.call("POST", "/api/auth/signup", { body: { email: e.toUpperCase(), password: e } });
  expect(await same.text()).toContain("email address");
});

test("the display name defaults to the part before @, and email is stored trimmed and lower-case", async () => {
  const e = email();
  const res = await w.call("POST", "/api/auth/signup", { body: { email: `  ${e.toUpperCase()} `, password: pw() } });
  const data = await me(cookieOf(res));
  expect(data.user.email).toBe(e);
  expect(data.user.displayName).toBe(e.split("@")[0]);
  expect(data.household.name).toBe(`${e}'s home`);
});

test("sign-up is limited per source address (5 per hour)", async () => {
  const ip = "198.51.100.9";
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    const res = await w.call("POST", "/api/auth/signup", { ip, body: { email: email(), password: pw() } });
    statuses.push(res.status);
    if (res.status === 429) expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  }
  expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
});

test("login success clears the email's failure count; the dummy path never throws on odd input", async () => {
  const a = await signUp();
  for (let i = 0; i < 4; i++)
    await w.call("POST", "/api/auth/login", { body: { email: a.e, password: "wrong-wrong-1" } });
  expect((await w.call("POST", "/api/auth/login", { body: { email: a.e, password: a.p } })).status).toBe(200);
  for (let i = 0; i < 4; i++)
    await w.call("POST", "/api/auth/login", { body: { email: a.e, password: "wrong-wrong-1" } });
  expect((await w.call("POST", "/api/auth/login", { body: { email: a.e, password: a.p } })).status).toBe(200);
  expect((await w.call("POST", "/api/auth/login", { body: { email: 5, password: [] } })).status).toBe(401);
  expect((await w.call("POST", "/api/auth/login", { body: "[]" })).status).toBe(401);
});

test("household rename validates the name", async () => {
  const a = await signUp();
  for (const name of ["", "   ", "x".repeat(61), 5]) {
    expect((await w.call("PATCH", "/api/household", { cookie: a.cookie, body: { name } })).status).toBe(400);
  }
  expect((await w.call("PATCH", "/api/household", { cookie: a.cookie, body: { name: "  Our flat " } })).status).toBe(
    200,
  );
  expect((await me(a.cookie)).household.name).toBe("Our flat");
});

test("invites: listed without tokens, limited to five open, revocable, a revoked one cannot be used", async () => {
  const a = await signUp();
  const made: any[] = [];
  for (let i = 0; i < MAX_OPEN_INVITES; i++) {
    const res = await w.call("POST", "/api/invites", { cookie: a.cookie, body: {} });
    expect(res.status).toBe(201);
    made.push(await res.json());
  }
  expect(made[0].link).toBe(`/invite#${made[0].token}`);
  expect((await w.call("POST", "/api/invites", { cookie: a.cookie, body: {} })).status).toBe(409);
  const list = await (await w.call("GET", "/api/invites", { cookie: a.cookie })).text();
  expect(list).not.toContain(made[0].token);
  expect(JSON.parse(list).invites).toHaveLength(MAX_OPEN_INVITES);
  expect((await w.call("DELETE", `/api/invites/${made[0].id}`, { cookie: a.cookie })).status).toBe(200);
  expect((await w.call("DELETE", `/api/invites/${made[0].id}`, { cookie: a.cookie })).status).toBe(404);
  const joined = await w.call("POST", "/api/auth/signup", {
    body: { email: email(), password: pw(), inviteToken: made[0].token },
  });
  expect(joined.status).toBe(400);
  expect(
    (await w.call("POST", "/api/auth/signup", { body: { email: email(), password: pw(), inviteToken: made[1].token } }))
      .status,
  ).toBe(201);
});

test("an invite token is stored only as a hash", async () => {
  const a = await signUp();
  const { token } = (await (await w.call("POST", "/api/invites", { cookie: a.cookie, body: {} })).json()) as any;
  const rows = (await w.db.prepare("SELECT * FROM invites").all()).results;
  expect(JSON.stringify(rows)).not.toContain(token);
});

test("accept: own household's invite, a shared household and a bad token are refused alike or with 409", async () => {
  const a = await signUp();
  const b = await signUp();
  const own = (await (await w.call("POST", "/api/invites", { cookie: a.cookie, body: {} })).json()) as any;
  const bad = await w.call("POST", "/api/invites/accept", { cookie: a.cookie, body: { token: own.token } });
  expect(bad.status).toBe(400);
  expect((await w.call("POST", "/api/invites/accept", { cookie: a.cookie, body: { token: 5 } })).status).toBe(400);
  // b joins a; then a third person with an invite from someone else cannot bring b along (b shares a household)
  expect((await w.call("POST", "/api/invites/accept", { cookie: b.cookie, body: { token: own.token } })).status).toBe(
    200,
  );
  const c = await signUp();
  const other = (await (await w.call("POST", "/api/invites", { cookie: c.cookie, body: {} })).json()) as any;
  const shared = await w.call("POST", "/api/invites/accept", { cookie: b.cookie, body: { token: other.token } });
  expect(shared.status).toBe(409);
  expect((await me(b.cookie)).members).toHaveLength(2);
});

test("accept is limited per source after repeated bad tokens", async () => {
  const a = await signUp();
  const ip = "198.51.100.77";
  const seen: number[] = [];
  for (let i = 0; i < 11; i++) {
    seen.push(
      (await w.call("POST", "/api/invites/accept", { cookie: a.cookie, ip, body: { token: `bad${i}` } })).status,
    );
  }
  expect(seen.slice(0, 10).every((s) => s === 400)).toBe(true);
  expect(seen[10]).toBe(429);
});

async function pair() {
  const a = await signUp();
  const invite = (await (await w.call("POST", "/api/invites", { cookie: a.cookie, body: {} })).json()) as any;
  const b = await signUp({ inviteToken: invite.token });
  const bId = (await me(b.cookie)).user.id as string;
  const aId = (await me(a.cookie)).user.id as string;
  return { a, b, aId, bId };
}

test("reset: not yourself, not a stranger; the member sees mustChangePassword until a new password is set", async () => {
  const { a, b, aId, bId } = await pair();
  expect((await w.call("POST", `/api/members/${aId}/reset-password`, { cookie: a.cookie, body: {} })).status).toBe(400);
  const stranger = await signUp();
  expect(
    (await w.call("POST", `/api/members/${bId}/reset-password`, { cookie: stranger.cookie, body: {} })).status,
  ).toBe(404);
  const reset = await w.call("POST", `/api/members/${bId}/reset-password`, { cookie: a.cookie, body: {} });
  const temp = ((await reset.json()) as any).temporaryPassword as string;
  expect(temp).toHaveLength(16);
  const login = await w.call("POST", "/api/auth/login", { body: { email: b.e, password: temp } });
  expect(((await login.json()) as any).mustChangePassword).toBe(true);
  const cookie = cookieOf(login);
  expect((await w.call("GET", "/api/invites", { cookie })).status).toBe(403);
  expect((await w.call("PATCH", "/api/household", { cookie, body: { name: "x" } })).status).toBe(403);
  expect((await w.call("POST", "/api/auth/logout", { cookie, body: {} })).status).toBe(200);
});

test("password change: wrong current, weak or unchanged new password are refused; success ends other sessions", async () => {
  const a = await signUp();
  const other = await w.call("POST", "/api/auth/login", { body: { email: a.e, password: a.p } });
  const change = (body: unknown) => w.call("POST", "/api/me/password", { cookie: a.cookie, body });
  expect((await change({ currentPassword: "wrong-wrong-1", newPassword: pw() })).status).toBe(403);
  expect((await change({ currentPassword: a.p, newPassword: "short" })).status).toBe(400);
  expect((await change({ currentPassword: a.p, newPassword: a.p })).status).toBe(400);
  expect((await change({ currentPassword: 1, newPassword: 2 })).status).toBe(400);
  const next = pw();
  const ok = await change({ currentPassword: a.p, newPassword: next });
  expect(ok.status).toBe(200);
  expect((await w.call("GET", "/api/me", { cookie: a.cookie })).status).toBe(401);
  expect((await w.call("GET", "/api/me", { cookie: cookieOf(other) })).status).toBe(401);
  expect((await w.call("GET", "/api/me", { cookie: cookieOf(ok) })).status).toBe(200);
});

test("password change failures are limited per source", async () => {
  const a = await signUp();
  const ip = "198.51.100.88";
  const seen: number[] = [];
  for (let i = 0; i < 11; i++) {
    const r = await w.call("POST", "/api/me/password", {
      cookie: a.cookie,
      ip,
      body: { currentPassword: "nope-nope-12", newPassword: pw() },
    });
    seen.push(r.status);
  }
  expect(seen[10]).toBe(429);
});

test("an expired session row is removed when it is presented, and old rows are pruned at the next login", async () => {
  const a = await signUp();
  const mine = "user_id = (SELECT id FROM users WHERE email = ?)";
  const count = async (extra = "") =>
    ((await w.db.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE ${mine}${extra}`).bind(a.e).first()) as any).n;
  await w.db
    .prepare(`UPDATE sessions SET expires_at = ? WHERE ${mine}`)
    .bind(new Date(Date.now() - 1000).toISOString(), a.e)
    .run();
  expect((await w.call("GET", "/api/me", { cookie: a.cookie })).status).toBe(401);
  expect(await count()).toBe(0);
  await w.db
    .prepare(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) SELECT 'old-' || id, id, 'x', '2000-01-01T00:00:00.000Z' FROM users WHERE email = ?",
    )
    .bind(a.e)
    .run();
  expect(await count()).toBe(1);
  await w.call("POST", "/api/auth/login", { body: { email: a.e, password: a.p } });
  expect(await count(" AND token_hash LIKE 'old-%'")).toBe(0);
});

test("a session used after more than a day is renewed with a fresh cookie; used within a day it is not", async () => {
  const a = await signUp();
  const quick = await w.call("GET", "/api/me", { cookie: a.cookie });
  expect(quick.headers.getSetCookie()).toHaveLength(0);
  const soon = new Date(Date.now() + 40 * 86_400_000).toISOString();
  await w.db
    .prepare("UPDATE sessions SET expires_at = ? WHERE user_id = (SELECT id FROM users WHERE email = ?)")
    .bind(soon, a.e)
    .run();
  const renewed = await w.call("GET", "/api/me", { cookie: a.cookie });
  expect(renewed.headers.getSetCookie()[0]).toContain("Max-Age=7776000");
});
