import { createLogger } from "@hbb-emu/core";
import type * as IO from "fp-ts/IO";
import type { AnyOipfBinding, AnyStateful, StateKey } from "../binding";

const logger = createLogger("InstanceRegistry");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entry in the registry for a specific state key.
 */
export type RegistryEntry = Readonly<{
  binding: AnyOipfBinding;
  instances: Set<AnyStateful>;
}>;

/**
 * Map from state key to registry entry.
 */
export type RegistryMap = Map<StateKey, RegistryEntry>;

// ─────────────────────────────────────────────────────────────────────────────
// Registry Service
// ─────────────────────────────────────────────────────────────────────────────

export class InstanceRegistry {
  readonly #registry: RegistryMap = new Map();
  readonly #unsubscribers: WeakMap<AnyStateful, () => void> = new WeakMap();

  /**
   * Initializes registry entries for all bindings.
   */
  initialize =
    (bindings: ReadonlyArray<AnyOipfBinding>): IO.IO<void> =>
    () => {
      for (const binding of bindings) {
        this.#registry.set(binding.name, {
          binding,
          instances: new Set(),
        });
      }
      logger.debug(`Initialized registry with ${bindings.length} entries`)();
    };

  /**
   * Adds an instance to the registry and subscribes to its state changes.
   */
  addInstance =
    (
      stateKey: StateKey,
      instance: AnyStateful,
      onStateChange: (stateKey: StateKey, state: Partial<unknown>) => IO.IO<void>,
    ): IO.IO<void> =>
    () => {
      const entry = this.#registry.get(stateKey);
      if (!entry) {
        logger.error(`No registry entry for stateKey: ${stateKey}`)();
        return;
      }

      entry.instances.add(instance);

      // Subscribe to instance state changes
      const unsubscribe = instance.subscribe((state) => onStateChange(stateKey, state))();
      this.#unsubscribers.set(instance, unsubscribe);

      logger.debug(`Added instance for ${stateKey}, total: ${entry.instances.size}`)();
    };

  /**
   * Removes an instance from the registry and unsubscribes.
   */
  removeInstance =
    (stateKey: StateKey, instance: AnyStateful): IO.IO<void> =>
    () => {
      const entry = this.#registry.get(stateKey);
      if (!entry) return;

      entry.instances.delete(instance);

      // Unsubscribe
      const unsubscribe = this.#unsubscribers.get(instance);
      if (unsubscribe) {
        unsubscribe();
        this.#unsubscribers.delete(instance);
      }

      logger.debug(`Removed instance for ${stateKey}, remaining: ${entry.instances.size}`)();
    };

  /**
   * Gets all instances for a state key.
   */
  getInstances = (stateKey: StateKey): ReadonlySet<AnyStateful> => {
    return this.#registry.get(stateKey)?.instances ?? new Set();
  };

  /**
   * Gets the first instance for a state key (if any).
   */
  getFirstInstance = (stateKey: StateKey): AnyStateful | undefined => {
    const instances = this.getInstances(stateKey);
    return instances.size > 0 ? [...instances][0] : undefined;
  };

  /**
   * Gets all registered state keys.
   */
  getStateKeys = (): ReadonlyArray<StateKey> => {
    return [...this.#registry.keys()];
  };

  /**
   * Gets the binding for a state key.
   */
  getBinding = (stateKey: StateKey): AnyOipfBinding | undefined => {
    return this.#registry.get(stateKey)?.binding;
  };
}
