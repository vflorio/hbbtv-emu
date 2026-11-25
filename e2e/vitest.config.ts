import { defineConfig } from "vitest/config";

/** Not part of the unit test projects: needs built extensions and a browser. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.e2e.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
