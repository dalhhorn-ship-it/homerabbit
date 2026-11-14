import { Hono } from "hono";
import type { AppEnv } from "./env";
import { noStore, requireSession, sameOrigin, services } from "./middleware";
import { accountRoutes } from "./routes/account";
import { authRoutes } from "./routes/auth";
import { VERSION } from "./version";

export const api = new Hono<AppEnv>()
  .use("*", noStore, sameOrigin, services, requireSession)
  .get("/health", (c) => c.json({ ok: true, version: VERSION }))
  .route("/auth", authRoutes)
  .route("/", accountRoutes);

export const app = new Hono<AppEnv>().route("/api", api);
