import type { AnyOipfBinding } from "./binding";
import type { StateChangeCallback } from "./registry";

// ─────────────────────────────────────────────────────────────────────────────
// Provider Environment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Environment for the Object Provider.
 * Provides all dependencies needed to initialize and run the provider.
 */
export type ProviderEnv = Readonly<{
  /**
   * All binding definitions to be registered.
   */
  bindings: ReadonlyArray<AnyOipfBinding>;

  /**
   * Optional callback for state changes.
   * Called whenever an instance's state changes.
   */
  onStateChange?: StateChangeCallback;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a default ProviderEnv with the given bindings.
 */
export const createProviderEnv = (
  bindings: ReadonlyArray<AnyOipfBinding>,
  onStateChange?: StateChangeCallback,
): ProviderEnv => ({
  bindings,
  onStateChange,
});
