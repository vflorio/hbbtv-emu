import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import type { AnyOipfDefinition } from "../../../types";
import type { CallbackEnv, OnLocalStateChangeCallback } from "./callback";
import type { InstanceEnv } from "./instance";
import { emptyRegistry, type RegistryEnv } from "./registry";

export type StatefulEnv = CallbackEnv & InstanceEnv & RegistryEnv;

export const createStatefulEnv = (objectDefinitions: ReadonlyArray<AnyOipfDefinition>): StatefulEnv => ({
  registryRef: IORef.newIORef(emptyRegistry)(),
  callbackRef: IORef.newIORef<O.Option<OnLocalStateChangeCallback>>(O.none)(),
  objectDefinitions,
});
