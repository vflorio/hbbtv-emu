// Matcher Factory - creates ElementMatchers from OIPF object definitions
// Uses ReaderIO for dependency injection of ObjectStateManager

import { createLogger, type Stateful } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RIO from "fp-ts/ReaderIO";
import * as RA from "fp-ts/ReadonlyArray";
import { type OipfObject, toOipfObject } from "../../index";
import type {
  AnyOipfDefinition,
  CopyableOipfObjects,
  ObjectDefinition,
  ProxableOipfObjects,
  StateKey,
} from "../../types";
import { copyStrategy, proxyStrategy } from "./attachStrategy";
import type { ObjectStateManager } from "./objectStateManager";

const logger = createLogger("ElementMatcher");

// ─────────────────────────────────────────────────────────────────────────────
// Environment (dependencies for ReaderIO)
// ─────────────────────────────────────────────────────────────────────────────

export type MatcherEnv = Readonly<{
  stateManager: ObjectStateManager;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ElementMatcher<E extends Element, T> {
  name: string;
  selector: string;
  predicate: (element: Element) => element is E;
  transform: (element: E) => T;
  onDetected: (item: T) => IO.IO<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure Functions
// ─────────────────────────────────────────────────────────────────────────────

const applyAttachStrategy = <T>(
  strategy: "copy" | "proxy",
  oipfObject: OipfObject,
  instance: T,
): IO.IO<void> => {
  switch (strategy) {
    case "copy":
      return copyStrategy(oipfObject, instance as CopyableOipfObjects);
    case "proxy":
      return proxyStrategy(oipfObject, instance as ProxableOipfObjects);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ReaderIO Functions (access dependencies via Env)
// ─────────────────────────────────────────────────────────────────────────────

// Register instance with state manager - reads stateManager from Env
const registerInstance = <T extends Stateful<S>, S, K extends StateKey>(
  definition: ObjectDefinition<T, S, K>,
  instance: T,
): RIO.ReaderIO<MatcherEnv, () => void> =>
  pipe(
    RIO.ask<MatcherEnv>(),
    RIO.flatMapIO(({ stateManager }) => stateManager.registerInstance(definition, instance)),
  );

// Handle element detection - creates instance, registers it, applies attach strategy
const handleElementDetected = <T extends Stateful<S>, S, K extends StateKey>(
  definition: ObjectDefinition<T, S, K>,
  oipfObject: OipfObject,
): RIO.ReaderIO<MatcherEnv, void> =>
  pipe(
    RIO.fromIO(logger.debug(`${definition.name} detected, creating instance`)),
    RIO.flatMapIO(() => IO.of(definition.factory())),
    RIO.flatMap((instance) =>
      pipe(
        registerInstance(definition, instance),
        RIO.flatMapIO(() => applyAttachStrategy(definition.attachStrategy, oipfObject, instance)),
      ),
    ),
  );

// Create matcher - the onDetected callback runs the ReaderIO with the provided env
const createMatcher = <T extends Stateful<S>, S, K extends StateKey>(
  definition: ObjectDefinition<T, S, K>,
  env: MatcherEnv,
): ElementMatcher<HTMLObjectElement, OipfObject> => ({
  name: definition.name,
  selector: definition.selector,
  predicate: definition.predicate,
  transform: toOipfObject,
  // Execute the ReaderIO by providing the env at the boundary
  onDetected: (oipfObject) => handleElementDetected(definition, oipfObject)(env),
});

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

// Creates an ElementMatcher from an OIPF object definition
// The env is captured at creation time, making the matcher self-contained
export const createMatcherFromDefinition = <T extends Stateful<S>, S, K extends StateKey>(
  definition: ObjectDefinition<T, S, K>,
  stateManager: ObjectStateManager,
): ElementMatcher<HTMLObjectElement, OipfObject> =>
  createMatcher(definition, { stateManager });

// Creates ElementMatchers from multiple definitions
export const createMatcherFromDefinitions = (
  definitions: ReadonlyArray<AnyOipfDefinition>,
  stateManager: ObjectStateManager,
): ReadonlyArray<ElementMatcher<HTMLObjectElement, OipfObject>> =>
  pipe(
    definitions,
    RA.map((def) => createMatcherFromDefinition(def, stateManager)),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Alternative: Full ReaderIO API (for more complex scenarios)
// ─────────────────────────────────────────────────────────────────────────────

// Create a matcher as ReaderIO - useful when you want to defer env injection
export const createMatcherRIO = <T extends Stateful<S>, S, K extends StateKey>(
  definition: ObjectDefinition<T, S, K>,
): RIO.ReaderIO<MatcherEnv, ElementMatcher<HTMLObjectElement, OipfObject>> =>
  pipe(
    RIO.ask<MatcherEnv>(),
    RIO.map((env) => createMatcher(definition, env)),
  );

// Create all matchers as ReaderIO
export const createMatchersRIO = (
  definitions: ReadonlyArray<AnyOipfDefinition>,
): RIO.ReaderIO<MatcherEnv, ReadonlyArray<ElementMatcher<HTMLObjectElement, OipfObject>>> =>
  pipe(
    definitions,
    RA.traverse(RIO.Applicative)(createMatcherRIO),
  );
