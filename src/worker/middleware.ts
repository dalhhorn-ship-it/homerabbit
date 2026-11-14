// Request plumbing: services, the Origin check, and the session gate. The only file besides auth/ and repo.ts that
// touches `env.DB`; routes get `c.get("auth")` and `c.get("repo")` and nothing else (enforced by a unit test).
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { SESSION_MS } from "../domain/auth";
import { createAuthService } from "./auth/service";
import type { AppEnv } from "./env";
import { forHousehold } from "./repo";

export const COOKIE = "__Host-hr_session";
const PUBLIC = new Set(["GET /api/health", "POST /api/auth/signup", "POST /api/auth/login"]);
// With a temporary password in use, only these work until a new one is chosen.
const WHILE_MUST_CHANGE = new Set(["/api/me", "/api/me/password", "/api/auth/logout"]);

export const setSessionCookie = (c: Context, token: string) =>
  setCookie(c, COOKIE, token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: SESSION_MS / 1000 });

export const clearSessionCookie = (c: Context) => deleteCookie(c, COOKIE, { path: "/", secure: true });

export const clientIp = (c: Context): string => c.req.header("CF-Connecting-IP") ?? "unknown";

/** Nothing under /api is ever cached by the browser or an intermediary: responses are per user (and may set cookies). */
export const noStore: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
};

export const services: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.env?.DB) c.set("auth", createAuthService(c.env.DB)); // /api/health runs without bindings in unit tests
  await next();
};

/** CSRF: every request that can change state must carry an Origin equal to the app's own (SameSite=Lax is the
 * second layer). Stricter than Hono's csrf(), which only looks at form content types. */
export const sameOrigin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD" && c.req.method !== "OPTIONS") {
    if (c.req.header("Origin") !== new URL(c.req.url).origin) return c.json({ error: "Forbidden." }, 403);
  }
  await next();
};

/** 401 without a valid session, for every /api path except the public routes (also unknown paths and foreign ids,
 * so an anonymous caller learns nothing). Sets the household-scoped repo for the handlers. */
export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (PUBLIC.has(`${c.req.method} ${c.req.path}`)) return next();
  const token = getCookie(c, COOKIE);
  const resolved = token ? await c.get("auth").resolve(token) : null;
  if (!token || !resolved) {
    if (token) clearSessionCookie(c);
    return c.json({ error: "Not signed in." }, 401);
  }
  const { session, renewed } = resolved;
  if (renewed) setSessionCookie(c, token);
  if (session.mustChangePassword && !WHILE_MUST_CHANGE.has(c.req.path)) {
    return c.json({ error: "Choose a new password first.", mustChangePassword: true }, 403);
  }
  c.set("session", session);
  c.set("repo", forHousehold(c.env.DB, session.householdId));
  await next();
};
