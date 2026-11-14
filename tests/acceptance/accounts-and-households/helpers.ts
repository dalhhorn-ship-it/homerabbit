// Shared harness for the accounts-and-households acceptance tests (PRD docs/specs/accounts-and-households.md).
// It talks to the Worker only through its public surface (ADR 0013): `app.request()` over the HTTP API, the cookie
// name, status codes and the documented D1 tables. The code under test is imported lazily so a missing feature
// fails inside a test body. HR_APP_ROOT (a second-reading dir) replaces the project root when set; it needs
// `src/worker/app.ts` exporting `app`, `migrations/*.sql`, and node_modules (symlink the project's).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Miniflare } from "miniflare";
import { vi } from "vitest";

export const SESSION_COOKIE = "__Host-hr_session";
const ROOT = process.env.HR_APP_ROOT || process.cwd();
const ORIGIN = "http://localhost";

let counter = 0;
const rand = () => Math.random().toString(36).slice(2, 10);

export function uniqueEmail(tag: string): string {
  counter += 1;
  return `${tag}-${counter}-${rand()}@example.test`.toLowerCase();
}

// A strong, unique, 10+ character secret that is not on any common-password list.
export function strongPw(): string {
  return `Zq${rand()}-${rand()}-Wv${counter}`;
}

function sqlStatements(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function loadApp(): Promise<{ app: any }> {
  return import(/* @vite-ignore */ pathToFileURL(join(ROOT, "src/worker/app.ts")).href);
}

export interface Reply {
  status: number;
  headers: Headers;
  text: string;
  json: any;
  bytes: Uint8Array;
}

export interface World {
  app: any;
  db: any;
  photos: any;
  mf: Miniflare;
  pending: Promise<unknown>[];
  nextIp: () => string;
  all: (sql: string, ...args: unknown[]) => Promise<Record<string, unknown>[]>;
  tableExists: (name: string) => Promise<boolean>;
  close: () => Promise<void>;
}

export async function createWorld(): Promise<World> {
  // Miniflare 5 option shape: bindings under workers[].config.env, code under config.manifest.
  const mf = new Miniflare({
    workers: [
      {
        config: {
          name: "acceptance",
          compatibilityDate: "2026-11-01",
          env: { DB: { type: "d1", id: "acceptance-db" }, PHOTOS: { type: "r2", name: "acceptance-photos" } },
          manifest: {
            mainModule: "worker.mjs",
            modules: {
              "worker.mjs": { type: "esm", contents: "export default { fetch() { return new Response('unused'); } }" },
            },
          },
        },
      },
    ],
  });
  const db = await mf.getD1Database("DB");
  const photos = await mf.getR2Bucket("PHOTOS");
  const dir = join(ROOT, "migrations");
  let files: string[] = [];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    files = [];
  }
  for (const f of files) {
    for (const stmt of sqlStatements(readFileSync(join(dir, f), "utf8"))) {
      await db.prepare(stmt).run();
    }
  }
  const mod = await loadApp();
  const world: World = {
    app: mod.app,
    db,
    photos,
    mf,
    pending: [],
    nextIp: () => "",
    all: async (sql, ...args) =>
      (
        await db
          .prepare(sql)
          .bind(...args)
          .all()
      ).results as Record<string, unknown>[],
    tableExists: async (name) =>
      (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").bind(name).all()).results
        .length > 0,
    close: () => mf.dispose(),
  };
  // Unique, valid IPv4 per client (documentation ranges), so per-IP limits never couple tests.
  let n = 0;
  world.nextIp = () => {
    n += 1;
    return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
  };
  return world;
}

export class Client {
  cookies = new Map<string, string>();
  ip: string;
  constructor(
    public w: World,
    ip?: string,
  ) {
    this.ip = ip ?? w.nextIp();
  }

  cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async send(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<Reply> {
    const headers: Record<string, string> = { Origin: ORIGIN, "CF-Connecting-IP": this.ip, ...extra };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const cookie = this.cookieHeader();
    if (cookie) headers.Cookie = cookie;
    const ctx = {
      waitUntil: (p: Promise<unknown>) => {
        this.w.pending.push(p);
      },
      passThroughOnException: () => {},
    };
    const res: Response = await this.w.app.request(
      path,
      { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
      { DB: this.w.db, PHOTOS: this.w.photos },
      ctx,
    );
    await Promise.allSettled(this.w.pending.splice(0));
    const bytes = new Uint8Array(await res.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";").map((s) => s.trim());
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      const maxAge = attrs.find((a) => /^max-age=/i.test(a));
      if (value === "" || (maxAge && Number(maxAge.split("=")[1]) <= 0)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return { status: res.status, headers: res.headers, text, json, bytes };
  }
  get = (path: string) => this.send("GET", path);
  post = (path: string, body: unknown = {}) => this.send("POST", path, body);

  hasSession(): boolean {
    return this.cookies.has(SESSION_COOKIE);
  }

  // A second device holding the same session cookie (used to replay a cookie after logout or reset).
  cloneCookies(): Client {
    const c = new Client(this.w);
    c.cookies = new Map(this.cookies);
    return c;
  }
}

export const is2xx = (r: Reply) => r.status >= 200 && r.status < 300;
export const isRefusal = (r: Reply) => r.status >= 400 && r.status < 500 && r.status !== 429;

export interface Person {
  client: Client;
  email: string;
  pw: string;
}

export async function signUp(
  client: Client,
  email: string,
  pw: string,
  extra: Record<string, unknown> = {},
): Promise<Reply> {
  return client.post("/api/auth/signup", { email, password: pw, displayName: `User ${email.split("@")[0]}`, ...extra });
}

export async function login(client: Client, email: string, pw: string): Promise<Reply> {
  return client.post("/api/auth/login", { email, password: pw });
}

export async function newPerson(w: World, tag: string, extra: Record<string, unknown> = {}): Promise<Person> {
  const client = new Client(w);
  const email = uniqueEmail(tag);
  const pw = strongPw();
  const res = await signUp(client, email, pw, extra);
  if (!is2xx(res)) throw new Error(`sign-up of ${email} failed: ${res.status} ${res.text.slice(0, 200)}`);
  return { client, email, pw };
}

// Fake only Date, so session, invite and lockout times can be moved without slowing the real clock.
export function startClock() {
  vi.useFakeTimers({ toFake: ["Date"] });
  let t = Date.now();
  vi.setSystemTime(t);
  return {
    advance(ms: number) {
      t += ms;
      vi.setSystemTime(t);
    },
  };
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// ---- reading JSON replies without knowing their exact shape (ADR 0013 does not fix the field names) ----

export function walk(
  value: unknown,
  visit: (key: string | null, v: unknown, parent: unknown) => void,
  key: string | null = null,
  parent: unknown = null,
) {
  visit(key, value, parent);
  if (Array.isArray(value)) for (const v of value) walk(v, visit, null, value);
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, visit, k, value);
}

export function findString(json: unknown, keyRe: RegExp): string | null {
  let found: string | null = null;
  walk(json, (k, v) => {
    if (found === null && k && keyRe.test(k) && typeof v === "string" && v.length > 0) found = v;
  });
  return found;
}

// The invite token, taken from a link like `/invite#<token>` or a token/link/url field.
export function inviteToken(json: unknown): string {
  const raw = findString(json, /token|link|url/i);
  if (!raw) throw new Error(`no invite token or link in reply: ${JSON.stringify(json)}`);
  return raw.includes("#") ? raw.slice(raw.indexOf("#") + 1) : raw;
}

// The id of the object that carries `email` (a member entry in the /api/me reply).
export function memberId(json: unknown, email: string): string {
  let id: string | null = null;
  walk(json, (_k, v) => {
    if (id === null && v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      if (o.email === email && typeof o.id === "string") id = o.id;
    }
  });
  if (!id) throw new Error(`no member with email ${email} and an id in ${JSON.stringify(json)}`);
  return id;
}

export const homeName = (email: string) => `${email}'s home`;

export async function createInvite(p: Person): Promise<string> {
  const res = await p.client.post("/api/invites", {});
  if (!is2xx(res)) throw new Error(`creating an invite failed: ${res.status} ${res.text.slice(0, 200)}`);
  return inviteToken(res.json);
}

export async function householdIdOf(w: World, email: string): Promise<string> {
  const rows = await w.all("SELECT household_id AS h FROM users WHERE email = ?", email);
  if (rows.length !== 1) throw new Error(`no user row for ${email}`);
  return rows[0].h as string;
}

export async function userIdOf(w: World, email: string): Promise<string> {
  const rows = await w.all("SELECT id FROM users WHERE email = ?", email);
  if (rows.length !== 1) throw new Error(`no user row for ${email}`);
  return rows[0].id as string;
}
