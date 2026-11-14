import { Hono } from "hono";
import { VERSION } from "./version";

export const api = new Hono().get("/health", (c) => c.json({ ok: true, version: VERSION }));

export const app = new Hono().route("/api", api);
