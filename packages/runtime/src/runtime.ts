import { type ClassType, compose, createLogger, WithDomObserver } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { initializeOipfObjectFactory } from "./apis/objectFactory";
import { initializeUserAgent } from "./apis/userAgent";
import { objectDefinitions } from "./objectDefinitions";
import { type ElementMatcherManager, WithElementMatcherManager } from "./providers/object/elementMatcherManager";
import { type ElementStateManager, WithElementStateManager } from "./providers/object/elementStateManager";

const logger = createLogger("Provider");

export const WithApp = <T extends ClassType<ElementMatcherManager & ElementStateManager>>(Base: T) =>
  class extends Base {
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
export const Runtime = compose(
  class {},
  WithDomObserver,
  WithElementStateManager,
  WithElementMatcherManager,
  WithApp,
);

export type Instance = InstanceType<typeof Runtime>;
