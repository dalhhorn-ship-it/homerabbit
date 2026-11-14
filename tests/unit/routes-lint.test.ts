// Isolation by construction (ADR 0013): route handlers get the household-scoped repo and the auth service, never the
// database or the photo bucket. A route that mentions them fails this test.
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

const FORBIDDEN = [
  /env\.DB/,
  /\.prepare\(/,
  /env\.PHOTOS/,
  /\bPHOTOS\b/,
  /\.batch\(/,
  /\bD1\b/,
  /auth\/store/,
  /auth\/limits/,
];

test("no file under src/worker/routes touches the database directly", () => {
  const files = readdirSync("src/worker/routes").filter((f) => f.endsWith(".ts"));
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    const text = readFileSync(`src/worker/routes/${f}`, "utf8");
    for (const re of FORBIDDEN) expect(re.test(text), `${f} matches ${re}`).toBe(false);
  }
});

test("the lint would catch a violation", () => {
  expect(FORBIDDEN.some((re) => re.test("const r = c.env.DB.prepare('x')"))).toBe(true);
});
