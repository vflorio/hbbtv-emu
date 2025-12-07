import { type ClassType, compose, createLogger, type ExtensionState, WithDomObserver } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RA from "fp-ts/ReadonlyArray";
import { initializeOipfObjectFactory } from "./apis/oipfObjectFactory";
import { type ElementMatcherRegistry, WithElementMatcherRegistry } from "./elementMatcher";
import { createMatcherFromAnyDefinition } from "./matcherFactory";
import { allDefinitions } from "./oipfRegistry";
import { type StateManager, WithStateManager } from "./stateManager";

const logger = createLogger("Provider");

export const WithApp = <T extends ClassType<ElementMatcherRegistry & StateManager>>(Base: T) =>
  class extends Base implements ElementMatcherRegistry, StateManager {
    initialize = (config: ExtensionState) =>
      pipe(
        logger.info("Initializing", config),
        IO.tap(() => initializeOipfObjectFactory),
        IO.flatMap(() =>
          pipe(
            allDefinitions,
            RA.map((definition) => createMatcherFromAnyDefinition(definition, this)),
            RA.traverse(IO.Applicative)((matcher) => this.registerMatcher(matcher)),
            IO.asUnit,
          ),
        ),
        IO.tap(() => this.initMatchers),
      );
  };

// biome-ignore format: composition
export const Provider = compose(
  class {},
  WithDomObserver,
  WithElementMatcherRegistry,
  WithStateManager,
  WithApp,
);

export type Instance = InstanceType<typeof Provider>;
