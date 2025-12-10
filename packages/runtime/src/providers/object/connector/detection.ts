import { createLogger, type Stateful } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import type { OipfObject } from "../../..";
import type { ObjectDefinition, StateKey } from "../../../types";
import { type InstanceEnv, registerInstance } from "../stateful/instance";
import { applyStrategy } from "./attach";

const logger = createLogger("Detection");

/** Detection requires InstanceEnv for registering instances */
export type DetectionEnv = InstanceEnv;

// Operations

/** Create instance from factory */
const createInstance = <T extends Stateful<S>, S, K extends StateKey>(
  definition: ObjectDefinition<T, S, K>,
): IO.IO<T> =>
  pipe(
    logger.debug("Creating instance for:", definition.name),
    IO.flatMap(() => IO.of(definition.factory())),
  );

/** Handle element detection - creates instance, registers it, applies attach strategy */
export const handleDetection =
  <T extends Stateful<S>, S, K extends StateKey>(
    definition: ObjectDefinition<T, S, K>,
    oipfObject: OipfObject,
  ): RIO.ReaderIO<DetectionEnv, void> =>
  (env) =>
    pipe(
      logger.debug(`${definition.name} detected`),
      IO.flatMap(() => createInstance(definition)),
      IO.flatMap((instance) =>
        pipe(
          registerInstance(definition, instance)(env),
          IO.flatMap(() => applyStrategy(definition.attachStrategy, oipfObject, instance)),
          IO.tap(() => logger.debug(`${definition.name} connected`)),
        ),
      ),
    );
