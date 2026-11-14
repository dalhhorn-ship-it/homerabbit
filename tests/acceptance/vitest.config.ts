import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Acceptance suite runner (tests/acceptance/**/*.test.ts). Kept apart from the root vitest.config.ts so `npx vitest run`
// (commands.test) never collects locked acceptance tests.
export default defineConfig({
  root: resolve(__dirname, "../.."),
  server: { fs: { strict: false } },
  test: {
    include: ["tests/acceptance/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
