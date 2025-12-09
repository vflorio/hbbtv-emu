// Provider State Management - bidirectional state flow between external state and OIPF instances

import type { ClassType, Stateful } from "@hbb-emu/core";
import type { HbbTVState } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as RM from "fp-ts/ReadonlyMap";
import * as S from "fp-ts/string";
import type { AnyOipfDefinition, ObjectDefinition, StateKey } from "../../types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type OnLocalStateChangeCallback = (type: StateKey, state: Partial<unknown>) => IO.IO<void>;

type RegistryEntry = Readonly<{
  definition: AnyOipfDefinition;
  instances: ReadonlySet<Stateful<unknown>>;
}>;

type InstanceRegistry = ReadonlyMap<StateKey, RegistryEntry>;

// ─────────────────────────────────────────────────────────────────────────────
// Pure Functions
// ─────────────────────────────────────────────────────────────────────────────

const emptyRegistry: InstanceRegistry = new Map();

const createEmptyEntry = (definition: AnyOipfDefinition): RegistryEntry => ({
  definition,
  instances: new Set(),
});

const addInstanceToEntry = (entry: RegistryEntry, instance: Stateful<unknown>): RegistryEntry => ({
  ...entry,
  instances: new Set([...entry.instances, instance]),
});

const removeInstanceFromEntry = (entry: RegistryEntry, instance: Stateful<unknown>): RegistryEntry => ({
  ...entry,
  instances: new Set([...entry.instances].filter((i) => i !== instance)),
});

const updateRegistry =
  (key: StateKey, updater: (entry: RegistryEntry) => RegistryEntry) =>
  (registry: InstanceRegistry): InstanceRegistry =>
    pipe(
      registry,
      RM.lookup(S.Eq)(key),
      O.map(updater),
      O.match(
        () => registry,
        (updated) => new Map([...registry, [key, updated]]),
      ),
    );

const initializeRegistryFromDefinitions = (definitions: ReadonlyArray<AnyOipfDefinition>): InstanceRegistry =>
  pipe(
    definitions,
    RA.reduce(emptyRegistry, (acc, def) => new Map([...acc, [def.stateKey, createEmptyEntry(def)]])),
  );

const getFirstInstance = (entry: RegistryEntry): O.Option<Stateful<unknown>> => pipe([...entry.instances], RA.head);

// ─────────────────────────────────────────────────────────────────────────────
// Effect Helpers
// ─────────────────────────────────────────────────────────────────────────────

const createInstanceChangeHandler =
  (callbackRef: IORef.IORef<O.Option<OnLocalStateChangeCallback>>, stateKey: StateKey) =>
  (changedState: Partial<unknown>): IO.IO<void> =>
    pipe(
      callbackRef.read,
      IO.flatMap(
        O.match(
          () => IO.of(undefined),
          (callback) => callback(stateKey, changedState),
        ),
      ),
    );

const applyStateToInstance =
  (definition: AnyOipfDefinition, stateSlice: unknown) =>
  (instance: Stateful<unknown>): IO.IO<void> =>
    definition.applyState(instance, stateSlice as Partial<unknown>);

const applyStateToEntry =
  (stateSlice: unknown) =>
  (entry: RegistryEntry): IO.IO<void> =>
    pipe(
      [...entry.instances],
      RA.traverse(IO.Applicative)(applyStateToInstance(entry.definition, stateSlice)),
      IO.map(() => undefined),
    );

const collectStateFromEntry = (entry: RegistryEntry): IO.IO<O.Option<Partial<unknown>>> =>
  pipe(
    getFirstInstance(entry),
    O.traverse(IO.Applicative)((instance) => entry.definition.getState(instance)),
  );

// ─────────────────────────────────────────────────────────────────────────────
// ObjectStateManager Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface ObjectStateManager {
  initializeStateManager: (objectDefinitions: ReadonlyArray<AnyOipfDefinition>) => IO.IO<void>;
  registerInstance: <T extends Stateful<S>, S>(
    definition: ObjectDefinition<T, S, StateKey>,
    instance: T,
  ) => IO.IO<() => void>;
  applyExternalState: (state: Partial<HbbTVState>) => IO.IO<void>;
  collectState: () => IO.IO<Partial<HbbTVState>>;
  setOnLocalStateChange: (callback: OnLocalStateChangeCallback) => IO.IO<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mixin Implementation
// ─────────────────────────────────────────────────────────────────────────────

export const WithObjectStateManager = <T extends ClassType>(Base: T) =>
  class extends Base implements ObjectStateManager {
    readonly #registryRef: IORef.IORef<InstanceRegistry> = IORef.newIORef(emptyRegistry)();
    readonly #callbackRef: IORef.IORef<O.Option<OnLocalStateChangeCallback>> = IORef.newIORef<
      O.Option<OnLocalStateChangeCallback>
    >(O.none)();

    initializeStateManager = (objectDefinitions: ReadonlyArray<AnyOipfDefinition>): IO.IO<void> =>
      pipe(IO.of(initializeRegistryFromDefinitions(objectDefinitions)), IO.flatMap(this.#registryRef.write));

    registerInstance = <I extends Stateful<S>, S>(
      definition: ObjectDefinition<I, S, StateKey>,
      instance: I,
    ): IO.IO<() => void> =>
      pipe(
        this.#registryRef.read,
        IO.flatMap((registry) =>
          pipe(
            registry,
            RM.lookup(S.Eq)(definition.stateKey),
            O.match(
              () => IO.of(() => {}),
              (_entry) =>
                pipe(
                  // Add instance to registry
                  this.#registryRef.modify(updateRegistry(definition.stateKey, (e) => addInstanceToEntry(e, instance))),
                  IO.flatMap(() => {
                    // Subscribe to instance changes
                    const handleChange = createInstanceChangeHandler(this.#callbackRef, definition.stateKey);
                    return definition.subscribe(instance, handleChange);
                  }),
                  IO.map((unsubscribe) => () => {
                    // Cleanup: remove instance and unsubscribe
                    this.#registryRef.modify(
                      updateRegistry(definition.stateKey, (e) => removeInstanceFromEntry(e, instance)),
                    )();
                    unsubscribe();
                  }),
                ),
            ),
          ),
        ),
      );

    applyExternalState = (state: Partial<HbbTVState>): IO.IO<void> =>
      pipe(
        this.#registryRef.read,
        IO.flatMap((registry) =>
          pipe(
            [...registry.entries()],
            RA.traverse(IO.Applicative)(([stateKey, entry]) =>
              pipe(
                O.fromNullable(state[stateKey]),
                O.match(
                  () => IO.of(undefined),
                  (stateSlice) => applyStateToEntry(stateSlice)(entry),
                ),
              ),
            ),
            IO.map(() => undefined),
          ),
        ),
      );

    collectState = (): IO.IO<Partial<HbbTVState>> =>
      pipe(
        this.#registryRef.read,
        IO.flatMap((registry) =>
          pipe(
            [...registry.entries()],
            RA.traverse(IO.Applicative)(([stateKey, entry]) =>
              pipe(
                collectStateFromEntry(entry),
                IO.map((maybeState) =>
                  pipe(
                    maybeState,
                    O.map((s) => [stateKey, s] as const),
                  ),
                ),
              ),
            ),
            IO.map(RA.compact),
            IO.map((pairs) => Object.fromEntries(pairs) as Partial<HbbTVState>),
          ),
        ),
      );

    setOnLocalStateChange = (callback: OnLocalStateChangeCallback): IO.IO<void> =>
      this.#callbackRef.write(O.some(callback));
  };
