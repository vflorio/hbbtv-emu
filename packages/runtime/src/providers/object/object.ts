import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import type { AnyOipfDefinition } from "../../types";
import { oipfObjectDefinitions } from "./definitions";
import { createStatefulEnv, initializeStatefulRegistry, type StatefulEnv } from "./stateful";

const logger = createLogger("Object Provider");

export type ObjectProviderEnv = StatefulEnv;

export const initializeObjectProvider: RIO.ReaderIO<StatefulEnv, void> = (env) =>
  pipe(
    logger.info("Initializing"),
    IO.flatMap(() => initializeStatefulRegistry(env)),
    IO.tap(() => logger.info("Initialized")),
  );

export const createObjectProviderEnv = (
  objectDefinitions: ReadonlyArray<AnyOipfDefinition> = oipfObjectDefinitions,
): ObjectProviderEnv => ({
  ...createStatefulEnv(objectDefinitions),
});
