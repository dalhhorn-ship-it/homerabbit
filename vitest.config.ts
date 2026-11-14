import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "istanbul",
      include: ["src/domain/**", "src/worker/**"],
      reporter: ["text-summary", "json-summary"],
    },
  },
});
