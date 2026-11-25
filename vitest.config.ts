import { defineConfig } from "vitest/config";

/**
 * Root config: runs every package as a Vitest project.
 * Used by `bun run test:watch` (watch mode on the whole monorepo).
 * CI and `bun run test` go through turbo, package by package.
 */
export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.ts",
      "packages/oipf/*/vitest.config.ts",
      "packages/player/*/vitest.config.ts",
      "packages/player/adapters/*/vitest.config.ts",
    ],
  },
});
