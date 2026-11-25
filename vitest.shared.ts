import { defineConfig } from "vitest/config";

/**
 * Base Vitest config shared by every package.
 *
 * Each package has a `vitest.config.ts` that merges this one and, at most,
 * overrides the environment (e.g. `jsdom` for code that touches the DOM):
 *
 *   export default mergeConfig(shared, defineConfig({ test: { environment: "jsdom" } }));
 *
 * Conventions:
 * - tests live next to the code they test: `foo.ts` → `foo.test.ts`
 * - tests are excluded from the build (`tsconfig.build.json`)
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/**/__tests__/**", "src/**/index.ts"],
    },
  },
});
