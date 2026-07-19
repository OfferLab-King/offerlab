import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["tests/integration/**/*.test.ts", "tests/security/**/*.test.ts"],
    passWithNoTests: false,
    restoreMocks: true,
    testTimeout: 20_000,
  },
});
