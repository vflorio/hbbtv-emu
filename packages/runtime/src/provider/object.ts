import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as RIO from "fp-ts/ReaderIO";
import type { AnyOipfDefinition } from "..";
import {
  type ConnectorEnv,
  createConnectorObserverEnv,
  createMatchers,
  registerMatchers,
  startObserver,
} from "./connector";
import { createStatefulEnv, initializeStatefulRegistry, type StatefulEnv } from "./stateful";

const logger = createLogger("Object Provider");

export type ObjectProviderEnv = StatefulEnv & ConnectorEnv;

export const createObjectProviderEnv = (objectDefinitions: ReadonlyArray<AnyOipfDefinition>): ObjectProviderEnv => ({
  ...createStatefulEnv(objectDefinitions),
  ...createConnectorObserverEnv(),
});

export const initializeObjectProvider: RIO.ReaderIO<ObjectProviderEnv, void> = pipe(
  RIO.fromIO(logger.info("Initializing")),
  // Initialize stateful registry
  RIO.flatMap(() => initializeStatefulRegistry),
  // Create and register matchers
  RIO.flatMap(() => createMatchers),
  RIO.flatMap((matchers) => registerMatchers(matchers)),
  // Start DOM observer
  RIO.flatMap(() => startObserver),
  RIO.tapIO(() => logger.info("Initialized")),
);
