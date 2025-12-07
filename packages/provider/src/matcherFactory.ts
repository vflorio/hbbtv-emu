/**
 * Matcher Factory
 *
 * Creates ElementMatchers from OIPF object definitions.
 * Centralizes instantiation and state management integration.
 */

import { createLogger } from "@hbb-emu/core";
import type { Stateful } from "@hbb-emu/hbbtv-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { type AvObject, copyStrategy, proxyStrategy } from "./attachStrategy";
import type { ElementMatcher } from "./elementMatcher";
import type { OipfObject } from "./index";
import type { AnyOipfDefinition, OipfBidirectionalDefinition, OipfObjectDefinition, StateKey } from "./oipfRegistry";
import type { StateManager } from "./stateManager";

const logger = createLogger("MatcherFactory");

/**
 * Transform function for HTMLObjectElement to OipfObject.
 */
const toOipfObject = (element: HTMLObjectElement): OipfObject => ({
  type: element.type as OipfObject["type"],
  element,
});

/**
 * Creates an ElementMatcher from a stateless OIPF object definition.
 */
export const createMatcherFromDefinition = <T, K extends StateKey>(
  definition: OipfObjectDefinition<T, K>,
): ElementMatcher<HTMLObjectElement, OipfObject> => ({
  name: definition.name,
  selector: definition.selector,
  predicate: definition.predicate,
  transform: toOipfObject,
  onDetected: (oipfObject): IO.IO<void> =>
    pipe(
      logger.debug(`${definition.name} detected, creating instance`),
      IO.flatMap(() => IO.of(definition.factory())),
      IO.flatMap((instance) => applyAttachStrategy(definition.attachStrategy, oipfObject, instance)),
    ),
});

/**
 * Creates an ElementMatcher from a bidirectional OIPF object definition.
 * Registers instances with StateManager for state sync.
 */
export const createBidirectionalMatcherFromDefinition = <T extends Stateful<S>, S, K extends StateKey>(
  definition: OipfBidirectionalDefinition<T, S, K>,
  stateManager: StateManager,
): ElementMatcher<HTMLObjectElement, OipfObject> => ({
  name: definition.name,
  selector: definition.selector,
  predicate: definition.predicate,
  transform: toOipfObject,
  onDetected: (oipfObject): IO.IO<void> =>
    pipe(
      logger.debug(`${definition.name} detected, creating instance`),
      IO.flatMap(() => IO.of(definition.factory())),
      IO.tap((instance) => stateManager.registerInstance(definition, instance)),
      IO.flatMap((instance) => applyAttachStrategy(definition.attachStrategy, oipfObject, instance)),
    ),
});

/**
 * Creates an ElementMatcher from any OIPF definition.
 * Automatically handles bidirectional vs stateless definitions.
 */
export const createMatcherFromAnyDefinition = (
  definition: AnyOipfDefinition,
  stateManager: StateManager,
): ElementMatcher<HTMLObjectElement, OipfObject> =>
  definition.bidirectional
    ? createBidirectionalMatcherFromDefinition(
        definition as OipfBidirectionalDefinition<Stateful<unknown>, unknown, StateKey>,
        stateManager,
      )
    : createMatcherFromDefinition(definition as OipfObjectDefinition<unknown, StateKey>);

/**
 * Applies the appropriate attach strategy based on definition.
 */
const applyAttachStrategy = <T>(strategy: "copy" | "proxy", oipfObject: OipfObject, instance: T): IO.IO<void> => {
  switch (strategy) {
    case "copy":
      return copyStrategy(oipfObject, instance as Parameters<typeof copyStrategy>[1]);
    case "proxy":
      return proxyStrategy(oipfObject, instance as AvObject);
  }
};
