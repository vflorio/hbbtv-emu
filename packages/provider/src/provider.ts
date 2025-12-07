import { type ClassType, compose, createLogger, type ExtensionState, WithDomObserver } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { avVideoBroadcastMatcher } from "./apis/avVideoBroadcast";
import { avVideoDashMatcher } from "./apis/avVideoDash";
import { avVideoMp4Matcher } from "./apis/avVideoMp4";
import { oipfApplicationManagerMatcher } from "./apis/oipfApplicationManager";
import { createOipfCapabilitiesMatcher } from "./apis/oipfCapabilities";
import { oipfConfigurationMatcher } from "./apis/oipfConfiguration";
import { initializeOipfObjectFactory } from "./apis/oipfObjectFactory";
import { type ElementMatcherRegistry, WithElementMatcherRegistry } from "./elementMatcher";
import { type StateManager, WithStateManager } from "./stateManager";

const logger = createLogger("Provider");

export const WithApp = <T extends ClassType<ElementMatcherRegistry & StateManager>>(Base: T) =>
  class extends Base implements ElementMatcherRegistry, StateManager {
    initialize = (config: ExtensionState) =>
      pipe(
        logger.info("Initializing", config),
        // TODO: connetti la config agli oggetti
        IO.tap(() => initializeOipfObjectFactory),
        IO.tap(() => this.registerMatcher(oipfApplicationManagerMatcher)),
        IO.tap(() => this.registerMatcher(createOipfCapabilitiesMatcher(this))),
        IO.tap(() => this.registerMatcher(oipfConfigurationMatcher)),
        IO.tap(() => this.registerMatcher(avVideoBroadcastMatcher)),
        IO.tap(() => this.registerMatcher(avVideoMp4Matcher)),
        IO.tap(() => this.registerMatcher(avVideoDashMatcher)),
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
