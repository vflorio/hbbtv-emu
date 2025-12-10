import { createLogger, type Stateful } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import * as RA from "fp-ts/ReadonlyArray";
import { type OipfObject, toOipfObject } from "../../..";
import type { AnyOipfDefinition, ObjectDefinition, StateKey } from "../../../types";
import type { ElementMatcher } from ".";
import { type DetectionEnv, handleDetection } from "./detection";

const logger = createLogger("Matcher");

/** Matcher requires DetectionEnv for handling detections */
export type MatcherEnv = DetectionEnv;

// Operations

/** Create an ElementMatcher from a definition, capturing env */
export const createMatcher =
  <T extends Stateful<S>, S, K extends StateKey>(
    definition: ObjectDefinition<T, S, K>,
  ): RIO.ReaderIO<MatcherEnv, ElementMatcher<HTMLObjectElement, OipfObject>> =>
  (env) =>
    pipe(
      logger.debug("Creating matcher for:", definition.name),
      IO.map(() => ({
        name: definition.name,
        selector: definition.selector,
        predicate: definition.predicate,
        transform: toOipfObject,
        onDetected: (oipfObject: OipfObject) => handleDetection(definition, oipfObject)(env),
      })),
    );

/** Create matchers from multiple definitions */
export const createMatchers =
  (
    definitions: ReadonlyArray<AnyOipfDefinition>,
  ): RIO.ReaderIO<MatcherEnv, ReadonlyArray<ElementMatcher<HTMLObjectElement, OipfObject>>> =>
  (env) =>
    pipe(
      logger.debug("Creating matchers for definitions:", definitions.length),
      IO.flatMap(() =>
        pipe(
          definitions,
          RA.traverse(IO.Applicative)((definition) => createMatcher(definition)(env)),
        ),
      ),
      IO.tap((matchers) => logger.debug("Created matchers:", matchers.length)),
    );
