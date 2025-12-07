/**
 * Provider State Management Mixin
 *
 * Manages the bidirectional state flow between:
 * - External state (from message bus / storage)
 * - OIPF instances (stateful objects in the page)
 *
 * When external state arrives:
 * 1. Extract relevant slice for each instance type
 * 2. Apply to all registered instances of that type
 *
 * When instance state changes:
 * 1. Collect changed state from instance
 * 2. Notify via callback (to be sent to bus)
 */

import type { ClassType, HbbTVState } from "@hbb-emu/core";
import type { OipfCapabilities } from "@hbb-emu/hbbtv-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";

export type OipfObjectType = "oipfCapabilities" | "oipfConfiguration" | "applicationManager" | "videoBroadcast";
export type OnLocalStateChangeCallback = (type: OipfObjectType, state: Partial<unknown>) => IO.IO<void>;

/**
 * Registry of stateful instances by type.
 */
type InstanceRegistry = {
  oipfCapabilities: Set<OipfCapabilities>;
  // TODO: add more as implemented
};

export interface StateManager {
  registerCapabilities: (instance: OipfCapabilities) => IO.IO<() => void>;
  applyExternalState: (state: Partial<HbbTVState>) => IO.IO<void>;
  collectState: () => IO.IO<Partial<HbbTVState>>;
  setOnLocalStateChange: (callback: OnLocalStateChangeCallback) => IO.IO<void>;
}

export const WithStateManager = <T extends ClassType>(Base: T) =>
  class extends Base implements StateManager {
    stateRegistry: InstanceRegistry = {
      oipfCapabilities: new Set(),
    };

    onLocalStateChange: OnLocalStateChangeCallback | null = null;

    registerCapabilities =
      (instance: OipfCapabilities): IO.IO<() => void> =>
      () => {
        this.stateRegistry.oipfCapabilities.add(instance);

        const unsubscribe = instance.subscribe(this.handleInstanceChange("oipfCapabilities"))();

        return () => {
          this.stateRegistry.oipfCapabilities.delete(instance);
          unsubscribe();
        };
      };

    handleInstanceChange = createInstanceChangeHandler(() => this.onLocalStateChange);

    applyExternalState = (state: Partial<HbbTVState>): IO.IO<void> => applyToRegistry(this.stateRegistry)(state);

    collectState = (): IO.IO<Partial<HbbTVState>> => collectFromRegistry(this.stateRegistry);

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
  (getCallback: () => OnLocalStateChangeCallback | null) =>
  (type: OipfObjectType) =>
  (changedState: Partial<unknown>): IO.IO<void> =>
    pipe(
      IO.of(changedState),
      IO.flatMap((state) => {
        const callback = getCallback();
        if (callback) {
          return callback(type, state);
        }
        return IO.of(undefined);
      }),
    );

/**
 * Apply external HbbTV state to registry instances.
 */
const applyToRegistry =
  (registry: InstanceRegistry) =>
  (state: Partial<HbbTVState>): IO.IO<void> =>
  () => {
    if (state.oipfCapabilities) {
      for (const instance of registry.oipfCapabilities) {
        instance.applyState(state.oipfCapabilities)();
      }
    }
    // TODO: Add more types as implemented
  };

/**
 * Collect state from all registered instances.
 */
const collectFromRegistry =
  (registry: InstanceRegistry): IO.IO<Partial<HbbTVState>> =>
  () => {
    const result: Partial<HbbTVState> = {};

    const capsIter = registry.oipfCapabilities.values().next();
    if (!capsIter.done) {
      result.oipfCapabilities = capsIter.value.getState()();
    }
    // TODO: Add more types as implemented

    return result;
  };
