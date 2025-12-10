import type { Stateful } from "@hbb-emu/core";
import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import type * as RIO from "fp-ts/ReaderIO";
import type { ObjectDefinition, StateKey } from "../../../types";
import { type CallbackEnv, createChangeHandler } from "./callback";
import { addInstance, lookupEntry, type RegistryEnv, readRegistry, removeInstance } from "./registry";

const logger = createLogger("Instance");

export type InstanceEnv = RegistryEnv & CallbackEnv;

/** Register an instance and return unsubscribe function */
export const registerInstance =
  <I extends Stateful<SS>, SS>(
    definition: ObjectDefinition<I, SS, StateKey>,
    instance: I,
  ): RIO.ReaderIO<InstanceEnv, () => void> =>
  (env) =>
    pipe(
      logger.debug("Registering instance for:", definition.stateKey),
      IO.flatMap(() => readRegistry(env)),
      IO.flatMap((registry) =>
        pipe(
          lookupEntry(definition.stateKey)(registry),
          O.match(
            () =>
              pipe(
                logger.warn("No entry found for:", definition.stateKey),
                IO.map(() => () => {}),
              ),
            (_entry) =>
              pipe(
                // Add instance to registry
                addInstance(definition.stateKey, instance)(env),
                // Create change handler and subscribe
                IO.flatMap(() => createChangeHandler(definition.stateKey)(env)),
                IO.flatMap((handleChange) => definition.subscribe(instance, handleChange)),
                IO.tap(() => logger.debug("Instance registered for:", definition.stateKey)),
                // Return cleanup function
                IO.map((unsubscribe) => createCleanup(env, definition.stateKey, instance, unsubscribe)),
              ),
          ),
        ),
      ),
    );

/** Create cleanup function for unregistering instance */
const createCleanup =
  (env: InstanceEnv, stateKey: StateKey, instance: Stateful<unknown>, unsubscribe: () => void) => () => {
    pipe(
      logger.debug("Unregistering instance for:", stateKey),
      IO.flatMap(() => removeInstance(stateKey, instance)(env)),
      IO.tap(() => IO.of(unsubscribe())),
    )();
  };
