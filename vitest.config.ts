import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Each test file runs in its own process with its own in-memory database.
    pool: "forks",
    env: { DATA_DIR: ":memory:", SCHEDULER: "0", NODE_ENV: "test" },
  },
});
