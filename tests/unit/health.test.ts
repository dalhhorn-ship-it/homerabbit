import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { app } from "../../src/worker/app";
import { VERSION } from "../../src/worker/version";

test("GET /api/health reports ok and the version", async () => {
  const res = await app.request("/api/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, version: VERSION });
});

test("version matches package.json", () => {
  expect(VERSION).toBe(JSON.parse(readFileSync("package.json", "utf8")).version);
});
