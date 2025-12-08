/**
 * Provider State Management
 *
 * Manages the bidirectional state flow between:
 * - External state (from message bus / storage)
 * - OIPF instances (stateful objects in the page)
 *
 * Uses the centralized oipfRegistry for definitions.
 */

import type { ClassType, Stateful } from "@hbb-emu/core";
import type { HbbTVState } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RA from "fp-ts/ReadonlyArray";
import type { AnyOipfDefinition, ObjectDefinition, StateKey } from "../../objectDefinitions";
export type OnLocalStateChangeCallback = (type: StateKey, state: Partial<unknown>) => IO.IO<void>;

/**
 * Entry in the instance registry.
 */
type RegistryEntry = Readonly<{
  definition: ObjectDefinition<any, any, StateKey>; //FIXME
  instances: Set<any>;
}>;

/**
 * Registry of stateful instances by stateKey.
 */
type InstanceRegistry = Map<StateKey, RegistryEntry>;

export interface ElementStateManager {
  /**
   * Register object definitions.
   */
  initializeStateManager: (objectDefinitions: ReadonlyArray<AnyOipfDefinition>) => IO.IO<void>;

  /**
   * Register an instance and subscribe to its changes.
   * Returns unsubscribe function.
   */
  registerInstance: <T extends Stateful<S>, S>(
    definition: ObjectDefinition<T, S, StateKey>,
    instance: T,
  ) => IO.IO<() => void>;

  /**
   * Apply external HbbTV state to all registered instances.
   */
  applyExternalState: (state: Partial<HbbTVState>) => IO.IO<void>;

  /**
   * Collect state from all registered instances.
   */
  collectState: () => IO.IO<Partial<HbbTVState>>;

  /**
   * Set callback for local state changes.
   */
  setOnLocalStateChange: (callback: OnLocalStateChangeCallback) => IO.IO<void>;
}

export const WithElementStateManager = <T extends ClassType>(Base: T) =>
  class extends Base implements ElementStateManager {
    instanceRegistry: InstanceRegistry = new Map();
    onLocalStateChange: OnLocalStateChangeCallback | null = null;

    initializeStateManager = (objectDefinitions: ReadonlyArray<AnyOipfDefinition>): IO.IO<void> =>
      pipe(
        objectDefinitions,
        RA.traverse(IO.Applicative)((definition) =>
          IO.of(() => {
            this.instanceRegistry.set(definition.stateKey, {
              definition,
              instances: new Set(),
            });
          }),
        ),
      );

    registerInstance = <I extends Stateful<S>, S>(
      definition: ObjectDefinition<I, S, StateKey>,
      instance: I,
    ): IO.IO<() => void> =>
      pipe(
        IO.Do,
        IO.bind("entry", () => IO.of(this.instanceRegistry.get(definition.stateKey))),
        IO.flatMap(({ entry }) => {
          if (!entry) {
            return IO.of(() => {});
          }

          // Add instance to registry
          entry.instances.add(instance);

          // Subscribe to instance changes
          const handleChange = createInstanceChangeHandler(() => this.onLocalStateChange, definition.stateKey);
          const unsubscribe = definition.subscribe(instance, handleChange)();

          // Return cleanup function
          return IO.of(() => {
            entry.instances.delete(instance);
            unsubscribe();
          });
        }),
      );

    applyExternalState =
      (state: Partial<HbbTVState>): IO.IO<void> =>
      () => {
        for (const [stateKey, entry] of this.instanceRegistry.entries()) {
          const stateSlice = state[stateKey];
          if (stateSlice !== undefined) {
            for (const instance of entry.instances) {
              entry.definition.applyState(instance, stateSlice)();
            }
          }
        }
      };

    collectState = (): IO.IO<Partial<HbbTVState>> => () => {
      const result: Partial<HbbTVState> = {};

      for (const [stateKey, entry] of this.instanceRegistry.entries()) {
        const firstInstance = entry.instances.values().next();
        if (!firstInstance.done) {
          const state = entry.definition.getState(firstInstance.value)();
          (result as Record<string, unknown>)[stateKey] = state;
        }
      }

      return result;
    };

    setOnLocalStateChange =
      (callback: OnLocalStateChangeCallback): IO.IO<void> =>
      () => {
        this.onLocalStateChange = callback;
      };
  };

/**
 * Creates a handler for instance state changes.
 */
const createInstanceChangeHandler =
  (getCallback: () => OnLocalStateChangeCallback | null, stateKey: StateKey) =>
  (changedState: Partial<unknown>): IO.IO<void> =>
    pipe(
      IO.of(changedState),
      IO.flatMap((state) => {
        const callback = getCallback();
        if (callback) {
          return callback(stateKey, state);
        }
        return IO.of(undefined);
      }),
    );
