import { type ClassType, compose, createLogger, WithDomObserver } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { objectDefinitions } from "./objectDefinitions";
import { initializeOipfObjectFactory } from "./oipfObjectFactory";
import { type ElementMatcherManager, WithElementMatcherManager } from "./providers/object/elementMatcherManager";
import { type ElementStateManager, WithElementStateManager } from "./providers/object/elementStateManager";
import { initializeUserAgent } from "./userAgent";

const logger = createLogger("Provider");

export const WithApp = <T extends ClassType<ElementMatcherManager & ElementStateManager>>(Base: T) =>
  class extends Base implements ElementMatcherManager, ElementStateManager {
    initialize = (extensionState: ExtensionState) =>
      pipe(
        logger.info("Initializing"),
        IO.tap(() => initializeUserAgent(extensionState)),
        IO.tap(() => initializeOipfObjectFactory),
        IO.tap(() => this.initializeStateManager(objectDefinitions)),
        IO.tap(() => this.initializeMatcherManager(objectDefinitions)),
        IO.tap(() => logger.info("Initialized")),
      );
  };

// biome-ignore format: composition
export const Provider = compose(
  class {},
  WithDomObserver,
  WithElementStateManager,
  WithElementMatcherManager,
  WithApp,
);

export type Instance = InstanceType<typeof Provider>;
