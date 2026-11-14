// Signed-in routes: who am I, the household and its members, invites, password changes and resets.
import { Hono } from "hono";
import { randomToken, sha256Hex } from "../auth/tokens";
import type { AppEnv } from "../env";
import { clientIp, setSessionCookie } from "../middleware";
import { readBody, refuse } from "./util";

const NAME_MAX = 60;

export const accountRoutes = new Hono<AppEnv>()
  .get("/me", async (c) => {
    const { userId, mustChangePassword } = c.get("session");
    const repo = c.get("repo");
    const [household, members] = await Promise.all([repo.household(), repo.members()]);
    const user = members.find((m) => m.id === userId);
    return c.json({ user, household, members, mustChangePassword });
  })
  .post("/me/password", async (c) => {
    const b = await readBody(c);
    const res = await c.get("auth").changePassword({
      userId: c.get("session").userId,
      current: b.currentPassword,
      next: b.newPassword,
      ip: clientIp(c),
    });
    if (!res.ok) return refuse(c, res);
    setSessionCookie(c, res.token); // every session ended, this device gets a fresh one
    return c.json({ ok: true });
  })
  .patch("/household", async (c) => {
    const { name } = await readBody(c);
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed || trimmed.length > NAME_MAX)
      return c.json({ error: `Name must be 1 to ${NAME_MAX} characters.` }, 400);
    await c.get("repo").rename(trimmed);
    return c.json({ ok: true, name: trimmed });
  })
  .get("/invites", async (c) => c.json({ invites: await c.get("repo").openInvites(Date.now()) }))
  .post("/invites", async (c) => {
    const token = randomToken();
    const invite = await c.get("repo").createInvite(c.get("session").userId, await sha256Hex(token), Date.now());
    if (!invite) return c.json({ error: "Too many open invites. Revoke one first." }, 409);
    // The token is shown once; only its hash is stored. The fragment keeps it out of server logs and Referer.
    return c.json({ ...invite, token, link: `/invite#${token}` }, 201);
  })
  .delete("/invites/:id", async (c) => {
    return (await c.get("repo").revokeInvite(c.req.param("id")))
      ? c.json({ ok: true })
      : c.json({ error: "Not found." }, 404);
  })
  .post("/invites/accept", async (c) => {
    const b = await readBody(c);
    const res = await c.get("auth").acceptInvite({ userId: c.get("session").userId, token: b.token, ip: clientIp(c) });
    return res.ok ? c.json({ ok: true }) : refuse(c, res);
  })
  .post("/members/:id/reset-password", async (c) => {
    const res = await c.get("auth").resetMemberPassword(c.get("repo"), c.get("session").userId, c.req.param("id"));
    return res.ok ? c.json({ temporaryPassword: res.password }) : refuse(c, res);
  });
