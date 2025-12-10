import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import type { AnyOipfDefinition } from "../..";
import {
  type ConnectorEnv,
  createConnectorObserverEnv,
  createMatchers,
  registerMatchers,
  startObserver,
} from "./connector";
import { oipfObjectDefinitions } from "./definitions";
import { createStatefulEnv, initializeStatefulRegistry, type StatefulEnv } from "./stateful";

const logger = createLogger("Object Provider");

export type ObjectProviderEnv = StatefulEnv & ConnectorEnv;

export const createObjectProviderEnv = (
  objectDefinitions: ReadonlyArray<AnyOipfDefinition> = oipfObjectDefinitions,
): ObjectProviderEnv => ({
  ...createStatefulEnv(objectDefinitions),
  ...createConnectorObserverEnv(),
});

export const initializeObjectProvider: RIO.ReaderIO<ObjectProviderEnv, void> = (env) =>
  pipe(
    logger.info("Initializing"),
    // Initialize stateful registry
    IO.flatMap(() => initializeStatefulRegistry(env)),
    // Create and register matchers
    IO.flatMap(() => createMatchers(env)),
    IO.flatMap((matchers) => registerMatchers(matchers)(env)),
    // Start DOM observer
    IO.flatMap(() => startObserver(env)),
    IO.tap(() => logger.info("Initialized")),
  );
