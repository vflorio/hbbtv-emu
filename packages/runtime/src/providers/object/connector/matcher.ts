import { createLogger, type Stateful } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import * as RA from "fp-ts/ReadonlyArray";
import type { AnyOipfDefinition, ObjectDefinition, StateKey } from "../../..";
import type { DetectedElement } from "./";
import { type DetectionEnv, handleDetection } from "./detection";

/** Generic element matcher that transforms elements and handles detection */
export interface ElementMatcher<E extends Element, T> {
  readonly name: string;
  readonly selector: string;
  readonly predicate: (element: Element) => element is E;
  readonly transform: (element: E) => T;
  readonly onDetected: (item: T) => IO.IO<void>;
}

/** Type alias for HTMLObjectElement matchers (OIPF objects) */
export type OipfMatcher<T> = ElementMatcher<HTMLObjectElement, T>;

/** Matcher requires DetectionEnv for handling detections + object definitions */
export type MatcherEnv = DetectionEnv &
  Readonly<{
    objectDefinitions: ReadonlyArray<AnyOipfDefinition>;
  }>;

export const createMatcherEnv = (
  objectDefinitions: ReadonlyArray<AnyOipfDefinition>,
  detectionEnv: DetectionEnv,
): MatcherEnv => ({
  ...detectionEnv,
  objectDefinitions,
});

const logger = createLogger("Matcher");

// Operations

/** Create an ElementMatcher from a definition, capturing env */
export const createMatcher =
  <T extends Stateful<S>, S, K extends StateKey>(
    definition: ObjectDefinition<T, S, K>,
  ): RIO.ReaderIO<MatcherEnv, ElementMatcher<HTMLObjectElement, DetectedElement>> =>
  (env) =>
    pipe(
      logger.debug("Creating matcher for:", definition.name),
      IO.map(() => ({
        name: definition.name,
        selector: definition.selector,
        predicate: definition.predicate,
        onDetected: (detected) => handleDetection(definition, detected)(env),
        transform: (element: HTMLObjectElement): DetectedElement => ({
          mimeType: element.type as OIPF.DAE.MimeType,
          element,
        }),
      })),
    );

/** Create matchers from multiple definitions */
export const createMatchers: RIO.ReaderIO<
  MatcherEnv,
  ReadonlyArray<ElementMatcher<HTMLObjectElement, DetectedElement>>
> = (env) =>
  pipe(
    logger.debug("Creating matchers for definitions:", env.objectDefinitions.length),
    IO.flatMap(() =>
      pipe(
        env.objectDefinitions,
        RA.traverse(IO.Applicative)((definition) => createMatcher(definition)(env)),
      ),
    ),
    IO.tap((matchers) => logger.debug("Created matchers:", matchers.length)),
  );
