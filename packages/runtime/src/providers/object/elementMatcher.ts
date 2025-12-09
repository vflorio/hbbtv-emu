// Matcher Factory - creates ElementMatchers from OIPF object definitions

import { createLogger, type Stateful } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
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

export interface ElementMatcher<E extends Element, T> {
  name: string;
  selector: string;
  predicate: (element: Element) => element is E;
  transform: (element: E) => T;
  onDetected: (item: T) => IO.IO<void>;
}

// Creates an ElementMatcher from an OIPF object definition
export const createMatcherFromDefinition = <T extends Stateful<S>, S, K extends StateKey>(
  objectDefinition: ObjectDefinition<T, S, K>,
  objectStateManager: ObjectStateManager,
): ElementMatcher<HTMLObjectElement, OipfObject> => ({
  name: objectDefinition.name,
  selector: objectDefinition.selector,
  predicate: objectDefinition.predicate,
  transform: toOipfObject,
  onDetected: (oipfObject): IO.IO<void> =>
    pipe(
      logger.debug(`${objectDefinition.name} detected, creating instance`),
      IO.flatMap(() => IO.of(objectDefinition.factory())),
      IO.tap((instance) => objectStateManager.registerInstance(objectDefinition, instance)),
      IO.flatMap((instance) => applyAttachStrategy(objectDefinition.attachStrategy, oipfObject, instance)),
    ),
});

export const createMatcherFromDefinitions = (
  objectDefinitions: ReadonlyArray<AnyOipfDefinition>,
  objectStateManager: ObjectStateManager,
): ReadonlyArray<ElementMatcher<HTMLObjectElement, OipfObject>> =>
  pipe(
    objectDefinitions,
    RA.map((objectDefinition) => createMatcherFromDefinition(objectDefinition, objectStateManager)),
  );

const applyAttachStrategy = <T>(strategy: "copy" | "proxy", oipfObject: OipfObject, instance: T): IO.IO<void> => {
  switch (strategy) {
    case "copy":
      return copyStrategy(oipfObject, instance as CopyableOipfObjects);
    case "proxy":
      return proxyStrategy(oipfObject, instance as ProxableOipfObjects);
  }
};
