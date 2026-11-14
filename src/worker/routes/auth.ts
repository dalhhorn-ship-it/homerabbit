import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../env";
import { COOKIE, clearSessionCookie, clientIp, setSessionCookie } from "../middleware";
import { readBody, refuse } from "./util";

export const authRoutes = new Hono<AppEnv>()
  .post("/signup", async (c) => {
    const b = await readBody(c);
    const res = await c.get("auth").signup({
      email: b.email,
      password: b.password,
      displayName: b.displayName,
      inviteToken: b.inviteToken,
      ip: clientIp(c),
    });
    if (!res.ok) return refuse(c, res);
    setSessionCookie(c, res.token);
    return c.json({ ok: true }, 201);
  })
  .post("/login", async (c) => {
    const b = await readBody(c);
    const res = await c.get("auth").login({ email: b.email, password: b.password, ip: clientIp(c) });
    if (!res.ok) return refuse(c, res);
    setSessionCookie(c, res.token);
    return c.json({ ok: true, mustChangePassword: res.mustChangePassword });
  })
  .post("/logout", async (c) => {
    const token = getCookie(c, COOKIE);
    if (token) await c.get("auth").logout(token);
    clearSessionCookie(c);
    return c.json({ ok: true });
  });
