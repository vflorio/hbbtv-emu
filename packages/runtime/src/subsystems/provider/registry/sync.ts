import { createLogger } from "@hbb-emu/core";
import type * as IO from "fp-ts/IO";
import type { StateKey } from "../binding";
import type { InstanceRegistry } from "./registry";

const logger = createLogger("StateSync");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global state shape: maps state keys to their state slices.
 */
export type GlobalState = Readonly<Partial<Record<StateKey, unknown>>>;

/**
 * Callback for external state changes.
 */
export type StateChangeCallback = (stateKey: StateKey, state: Partial<unknown>) => IO.IO<void>;

// ─────────────────────────────────────────────────────────────────────────────
// State Sync Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies external state to all instances in the registry.
 */
export const applyExternalState =
  (registry: InstanceRegistry, state: GlobalState): IO.IO<void> =>
  () => {
    for (const [stateKey, stateSlice] of Object.entries(state)) {
      if (stateSlice === undefined) continue;

      const instances = registry.getInstances(stateKey as StateKey);
      for (const instance of instances) {
        instance.applyState(stateSlice as Partial<unknown>)();
      }
    }
    logger.debug("Applied external state")();
  };

/**
 * Collects state from all instances in the registry.
 * Uses "first instance wins" semantics.
 */
export const collectState =
  (registry: InstanceRegistry): IO.IO<GlobalState> =>
  () => {
    const state: Partial<Record<StateKey, unknown>> = {};

    for (const stateKey of registry.getStateKeys()) {
      const instance = registry.getFirstInstance(stateKey);
      if (instance) {
        state[stateKey] = instance.getState()();
      }
    }

    return state;
  };

/**
 * Creates a state change handler for the registry.
 */
export const createStateChangeHandler = (
  callback: StateChangeCallback | null,
): ((stateKey: StateKey, state: Partial<unknown>) => IO.IO<void>) => {
  return (stateKey, state) => () => {
    if (callback) {
      callback(stateKey, state)();
    }
  };
};
