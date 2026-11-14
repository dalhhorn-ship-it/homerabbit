import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    testTimeout: 30_000,
    environment: "node",
    coverage: {
      provider: "istanbul",
      include: ["src/domain/**", "src/worker/auth/**", "src/worker/repo.ts"],
      reporter: ["text-summary", "json-summary"],
    },
  },
});
