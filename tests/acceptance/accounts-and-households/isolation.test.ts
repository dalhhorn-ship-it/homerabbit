// Criteria 8-9 of docs/specs/accounts-and-households.md: household isolation (the L3 isolation test) and password storage.
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  Client,
  createInvite,
  createWorld,
  homeName,
  householdIdOf,
  is2xx,
  loadApp,
  login,
  newPerson,
  type Person,
  signUp,
  strongPw,
  uniqueEmail,
  userIdOf,
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
  vi.restoreAllMocks();
});

const PUBLIC = new Set(["GET /api/health", "POST /api/auth/signup", "POST /api/auth/login"]);
const SKIP_AS_MEMBER = (path: string) =>
  path.startsWith("/api/auth/") || path === "/api/me/password" || path === "/api/invites/accept";

interface Route {
  method: string;
  path: string;
}

async function routesOf(): Promise<Route[]> {
  const { app } = (await loadApp()) as { app: { routes: Route[] } };
  const seen = new Set<string>();
  const out: Route[] = [];
  for (const r of app.routes) {
    const key = `${r.method} ${r.path}`;
    if (r.method === "ALL" || r.path.includes("*") || seen.has(key)) continue;
    seen.add(key);
    out.push({ method: r.method, path: r.path });
  }
  return out;
}

const params = (path: string) => [...path.matchAll(/:(\w+)/g)].map((m) => m[1]);
const fill = (path: string, id: string) => path.replace(/:\w+(\{[^}]*\})?/g, id);
const hasBytes = (hay: Uint8Array, needle: Uint8Array) => Buffer.from(hay).includes(Buffer.from(needle));

interface Fixture {
  a: Person;
  b: Person;
  bIds: string[];
  markers: string[];
  photoBytes: Uint8Array;
  counts: () => Promise<Record<string, number>>;
  bMe: () => Promise<string>;
}

async function fixture(): Promise<Fixture> {
  const a = await newPerson(w, "c8a");
  const b = await newPerson(w, "c8b");
  const stamp = Math.random().toString(36).slice(2, 10);
  const bHousehold = await householdIdOf(w, b.email);
  const bIds = [bHousehold, await userIdOf(w, b.email)];
  const markers = [b.email];
  const photoBytes = new TextEncoder().encode(`PHOTO-BYTES-MARKER-${stamp}`);
  const now = new Date().toISOString();

  // B's invite, through the API.
  await createInvite(b);
  for (const r of await w.all("SELECT id FROM invites WHERE household_id = ?", bHousehold)) bIds.push(r.id as string);

  // B's rooms, items and photos exist from HR-8 / HR-2; seed them with the ADR 0013 columns when the tables exist.
  if (await w.tableExists("rooms")) {
    const roomId = crypto.randomUUID();
    const roomName = `ROOM-MARKER-${stamp}`;
    await w.db
      .prepare("INSERT INTO rooms (id, household_id, name, created_at) VALUES (?, ?, ?, ?)")
      .bind(roomId, bHousehold, roomName, now)
      .run();
    bIds.push(roomId);
    markers.push(roomName);
    if (await w.tableExists("items")) {
      const itemId = crypto.randomUUID();
      const title = `ITEM-MARKER-${stamp}`;
      await w.db
        .prepare(
          "INSERT INTO items (id, household_id, room_id, title, description, size, urgency, impact, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'M', 3, 3, 'backlog', ?, ?, ?)",
        )
        .bind(itemId, bHousehold, roomId, title, `DESC-MARKER-${stamp}`, bIds[1], now, now)
        .run();
      bIds.push(itemId);
      markers.push(title, `DESC-MARKER-${stamp}`);
      if (await w.tableExists("photos")) {
        const photoId = crypto.randomUUID();
        const key = `h/${bHousehold}/${itemId}/${photoId}.jpg`;
        await w.photos.put(key, photoBytes);
        await w.photos.put(`h/${bHousehold}/${itemId}/${photoId}-thumb.jpg`, photoBytes);
        await w.db
          .prepare(
            "INSERT INTO photos (id, household_id, item_id, r2_key, thumb_key, bytes, width, height, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 1600, 1200, ?, ?)",
          )
          .bind(photoId, bHousehold, itemId, key, key.replace(".jpg", "-thumb.jpg"), photoBytes.length, bIds[1], now)
          .run();
        bIds.push(photoId);
      }
    }
  }

  const tables = ["users", "invites", "rooms", "items", "photos", "sessions"];
  const counts = async () => {
    const out: Record<string, number> = {};
    for (const t of tables) {
      if (!(await w.tableExists(t))) continue;
      const col = t === "sessions" ? "user_id" : "household_id";
      const where = t === "sessions" ? bIds[1] : bHousehold;
      out[t] = ((await w.all(`SELECT COUNT(*) AS n FROM ${t} WHERE ${col} = ?`, where))[0].n as number) ?? 0;
    }
    return out;
  };
  return { a, b, bIds, markers, photoBytes, counts, bMe: async () => (await b.client.get("/api/me")).text };
}

function expectNoLeak(label: string, res: { text: string; bytes: Uint8Array }, f: Fixture) {
  for (const m of f.markers) expect(res.text.includes(m), `${label}: leaked ${m}`).toBe(false);
  expect(hasBytes(res.bytes, f.photoBytes), `${label}: leaked photo bytes`).toBe(false);
}

test("test_c8_signed_in_member_of_a_cannot_reach_any_b_resource", async () => {
  const f = await fixture();
  const routes = await routesOf();
  expect(routes.length, "the route table must be readable from app.routes").toBeGreaterThan(0);
  const beforeMe = await f.bMe();
  const beforeCounts = await f.counts();
  const bBodyIds = {
    id: f.bIds[0],
    householdId: f.bIds[0],
    userId: f.bIds[1],
    memberId: f.bIds[1],
    ownerId: f.bIds[1],
    roomId: f.bIds[2],
    itemId: f.bIds[3],
    photoId: f.bIds[4],
  };
  let probed = 0;

  for (const r of routes) {
    const key = `${r.method} ${r.path}`;
    if (PUBLIC.has(key) || SKIP_AS_MEMBER(r.path)) continue;
    const withBody = r.method !== "GET" && r.method !== "DELETE" && r.method !== "HEAD";
    if (params(r.path).length === 0) {
      const res = await f.a.client.send(r.method, r.path, withBody ? bBodyIds : undefined);
      expectNoLeak(`as A ${key}`, res, f);
      probed++;
      continue;
    }
    for (const id of f.bIds) {
      const res = await f.a.client.send(r.method, fill(r.path, id), withBody ? bBodyIds : undefined);
      const label = `as A ${r.method} ${fill(r.path, id)}`;
      expect(
        withBody ? [404, 400, 422].includes(res.status) : res.status === 404,
        `${label}: status ${res.status}`,
      ).toBe(true);
      expectNoLeak(label, res, f);
      probed++;
    }
  }
  expect(probed).toBeGreaterThan(0);

  expect(await f.bMe(), "B's own view is unchanged").toBe(beforeMe);
  expect(await f.counts(), "B's rows are unchanged").toEqual(beforeCounts);
  expect(is2xx(await login(new Client(w), f.b.email, f.b.pw)), "B can still log in with the same password").toBe(true);
  const meA = await f.a.client.get("/api/me");
  expectNoLeak("A's own /api/me", meA, f);
});

test("test_c8_anonymous_visitor_cannot_reach_any_b_resource", async () => {
  const f = await fixture();
  const routes = await routesOf();
  const beforeMe = await f.bMe();
  const beforeCounts = await f.counts();
  const anon = new Client(w);
  let probed = 0;

  for (const r of routes) {
    const key = `${r.method} ${r.path}`;
    if (PUBLIC.has(key) || r.path.startsWith("/api/auth/")) continue;
    const withBody = r.method !== "GET" && r.method !== "DELETE" && r.method !== "HEAD";
    const ids = params(r.path).length === 0 ? [""] : f.bIds;
    for (const id of ids) {
      const path = id ? fill(r.path, id) : r.path;
      const res = await anon.send(r.method, path, withBody ? { id: f.bIds[0], householdId: f.bIds[0] } : undefined);
      const label = `anonymous ${r.method} ${path}`;
      expect(res.status, label).toBe(401);
      expectNoLeak(label, res, f);
      probed++;
    }
  }
  expect(probed).toBeGreaterThan(0);
  expect(await f.bMe()).toBe(beforeMe);
  expect(await f.counts()).toEqual(beforeCounts);
});

test("test_c8_member_of_a_does_not_see_b_members_or_household", async () => {
  const f = await fixture();
  const meA = await f.a.client.get("/api/me");
  expect(meA.status).toBe(200);
  expect(meA.text).toContain(homeName(f.a.email));
  expect(meA.text).not.toContain(f.b.email);
  const meB = await f.b.client.get("/api/me");
  expect(meB.text).not.toContain(f.a.email);
});

test("test_c9_plaintext_password_is_not_stored_anywhere_in_the_database", async () => {
  const email = uniqueEmail("c9");
  const pw = strongPw();
  expect(is2xx(await signUp(new Client(w), email, pw))).toBe(true);
  expect(is2xx(await login(new Client(w), email, pw))).toBe(true);
  const tables = (
    await w.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    )
  ).map((r) => r.name as string);
  expect(tables).toContain("users");
  const encodings = [pw, btoa(pw), Buffer.from(pw).toString("hex"), encodeURIComponent(pw)];
  for (const t of tables) {
    const dump = JSON.stringify(await w.all(`SELECT * FROM ${t}`));
    for (const e of encodings)
      expect(dump.includes(e), `table ${t} contains the password (${e === pw ? "plain" : "encoded"})`).toBe(false);
  }
});

test("test_c9_same_password_for_two_accounts_gives_different_stored_values", async () => {
  const pw = strongPw();
  const e1 = uniqueEmail("c9s1");
  const e2 = uniqueEmail("c9s2");
  expect(is2xx(await signUp(new Client(w), e1, pw))).toBe(true);
  expect(is2xx(await signUp(new Client(w), e2, pw))).toBe(true);
  const [r1] = await w.all("SELECT * FROM users WHERE email = ?", e1);
  const [r2] = await w.all("SELECT * FROM users WHERE email = ?", e2);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const hashColumns = Object.keys(r1).filter((k) => {
    const a = r1[k];
    const b = r2[k];
    return (
      typeof a === "string" &&
      typeof b === "string" &&
      a !== b &&
      a.length >= 32 &&
      !uuid.test(a) &&
      !a.includes("@") &&
      !/^\d{4}-\d\d-\d\d/.test(a)
    );
  });
  expect(hashColumns.length, "a salted hash column must differ between the two accounts").toBeGreaterThan(0);
});

test("test_c9_password_is_never_logged", async () => {
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
  const email = uniqueEmail("c9log");
  const pw = strongPw();
  const wrong = strongPw();
  expect(is2xx(await signUp(new Client(w), email, pw))).toBe(true);
  await login(new Client(w), email, wrong);
  expect(is2xx(await login(new Client(w), email, pw))).toBe(true);
  await signUp(new Client(w), email, pw); // duplicate
  const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls.map((c) => c.map(String))));
  expect(logged.includes(pw), "password in logs").toBe(false);
  expect(logged.includes(wrong), "wrong password in logs").toBe(false);
});
