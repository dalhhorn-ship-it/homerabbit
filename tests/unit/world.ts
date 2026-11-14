// Test harness: the real Worker app on a Miniflare D1 with the real migrations (the same shape the acceptance suite uses).
import { readdirSync, readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { app } from "../../src/worker/app";

export interface World {
  db: any;
  mf: Miniflare;
  close: () => Promise<void>;
  call: (
    method: string,
    path: string,
    opts?: { body?: unknown; cookie?: string; ip?: string; origin?: string | null },
  ) => Promise<Response>;
}

export async function createWorld(): Promise<World> {
  const mf = new Miniflare({
    workers: [
      {
        config: {
          name: "unit",
          compatibilityDate: "2026-11-01",
          env: { DB: { type: "d1", id: "unit-db" } },
          manifest: {
            mainModule: "w.mjs",
            modules: { "w.mjs": { type: "esm", contents: "export default { fetch() { return new Response('x'); } }" } },
          },
        },
      },
    ],
  });
  const db = await mf.getD1Database("DB");
  for (const f of readdirSync("migrations")
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(`migrations/${f}`, "utf8").replace(/--.*$/gm, "");
    for (const stmt of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(stmt).run();
  }
  let n = 0;
  const call: World["call"] = (method, path, opts = {}) => {
    const headers: Record<string, string> = { "CF-Connecting-IP": opts.ip ?? `10.9.${(n >> 8) & 255}.${++n & 255}` };
    if (opts.origin !== null) headers.Origin = opts.origin ?? "http://localhost";
    if (opts.cookie) headers.Cookie = opts.cookie;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const init = { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) };
    return Promise.resolve(app.request(path, init, { DB: db, PHOTOS: {} }));
  };
  return { db, mf, call, close: () => mf.dispose() };
}

/** "name=value" for the session cookie a response set, or "" when it cleared or set none. */
export function cookieOf(res: Response): string {
  const line = res.headers.getSetCookie().find((l) => l.startsWith("__Host-hr_session="));
  if (!line) return "";
  const pair = line.split(";")[0];
  return pair.endsWith("=") ? "" : pair;
}
