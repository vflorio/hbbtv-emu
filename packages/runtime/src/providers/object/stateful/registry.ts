import type { Stateful } from "@hbb-emu/core";
import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import type * as RIO from "fp-ts/ReaderIO";
import * as RA from "fp-ts/ReadonlyArray";
import * as RM from "fp-ts/ReadonlyMap";
import * as S from "fp-ts/string";
import type { AnyOipfDefinition, StateKey } from "../../../types";

const logger = createLogger("Registry");

/** Environment for registry operations */
export type RegistryEnv = Readonly<{
  registryRef: IORef.IORef<InstanceRegistry>;
  objectDefinitions: ReadonlyArray<AnyOipfDefinition>;
}>;

export type RegistryEntry = Readonly<{
  definition: AnyOipfDefinition;
  instances: ReadonlySet<Stateful<unknown>>;
}>;

export type InstanceRegistry = ReadonlyMap<StateKey, RegistryEntry>;

// Pure

export const emptyRegistry: InstanceRegistry = new Map();

export const createEmptyEntry = (definition: AnyOipfDefinition): RegistryEntry => ({
  definition,
  instances: new Set(),
});

export const addInstanceToEntry = (entry: RegistryEntry, instance: Stateful<unknown>): RegistryEntry => ({
  ...entry,
  instances: new Set([...entry.instances, instance]),
});

export const removeInstanceFromEntry = (entry: RegistryEntry, instance: Stateful<unknown>): RegistryEntry => ({
  ...entry,
  instances: new Set([...entry.instances].filter((i) => i !== instance)),
});

export const updateRegistry =
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

export const initializeRegistryFromDefinitions = (definitions: ReadonlyArray<AnyOipfDefinition>): InstanceRegistry =>
  pipe(
    definitions,
    RA.reduce(emptyRegistry, (acc, def) => new Map([...acc, [def.stateKey, createEmptyEntry(def)]])),
  );

export const getFirstInstance = (entry: RegistryEntry): O.Option<Stateful<unknown>> =>
  pipe([...entry.instances], RA.head);

export const lookupEntry =
  (key: StateKey) =>
  (registry: InstanceRegistry): O.Option<RegistryEntry> =>
    RM.lookup(S.Eq)(key)(registry);

// Operations

/** Read current registry */
export const readRegistry: RIO.ReaderIO<RegistryEnv, InstanceRegistry> = (env) => env.registryRef.read;

/** Write registry */
export const writeRegistry =
  (registry: InstanceRegistry): RIO.ReaderIO<RegistryEnv, void> =>
  (env) =>
    env.registryRef.write(registry);

/** Modify registry with updater function */
export const modifyRegistry =
  (updater: (registry: InstanceRegistry) => InstanceRegistry): RIO.ReaderIO<RegistryEnv, void> =>
  (env) =>
    env.registryRef.modify(updater);

/** Add instance to registry */
export const addInstance =
  (stateKey: StateKey, instance: Stateful<unknown>): RIO.ReaderIO<RegistryEnv, void> =>
  (env) =>
    pipe(
      logger.debug("Adding instance to registry:", stateKey),
      IO.flatMap(() => env.registryRef.modify(updateRegistry(stateKey, (e) => addInstanceToEntry(e, instance)))),
    );

/** Remove instance from registry */
export const removeInstance =
  (stateKey: StateKey, instance: Stateful<unknown>): RIO.ReaderIO<RegistryEnv, void> =>
  (env) =>
    pipe(
      logger.debug("Removing instance from registry:", stateKey),
      IO.flatMap(() => env.registryRef.modify(updateRegistry(stateKey, (e) => removeInstanceFromEntry(e, instance)))),
    );

/** Initialize registry from definitions */
export const initializeStatefulRegistry: RIO.ReaderIO<RegistryEnv, void> = (env) =>
  pipe(
    logger.debug("Initializing registry with definitions:", env.objectDefinitions.length),
    IO.flatMap(() => IO.of(initializeRegistryFromDefinitions(env.objectDefinitions))),
    IO.flatMap(env.registryRef.write),
    IO.tap(() => logger.debug("Registry initialized")),
  );
