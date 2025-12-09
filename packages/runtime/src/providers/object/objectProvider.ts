import { type ClassType, compose, createLogger, WithDomObserver } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { avVideoDashDefinition, avVideoMp4Definition } from "../../av";
import { oipfApplicationManagerDefinition } from "../../dae/applicationManager";
import { oipfCapabilitiesDefinition } from "../../dae/capabilities";
import { oipfConfigurationDefinition } from "../../dae/configuration";
import { videoBroadcastDefinition } from "../../dae/videoBroadcast";
import { type ElementMatcherManager, WithElementMatcherManager } from "../../providers/object/elementMatcherManager";
import { type ObjectStateManager, WithObjectStateManager } from "./objectStateManager";

export const objectDefinitions = [
  oipfCapabilitiesDefinition,
  oipfConfigurationDefinition,
  oipfApplicationManagerDefinition,
  videoBroadcastDefinition,
  avVideoMp4Definition,
  avVideoDashDefinition,
] as const;

const logger = createLogger("ObjectProvider");

export interface ObjectProvider {
  initializeProvider: IO.IO<void>;
}

const WithApp = <T extends ClassType<ElementMatcherManager & ObjectStateManager>>(Base: T) =>
  class extends Base implements ObjectProvider {
    initializeProvider = pipe(
      logger.info("Initializing"),
      IO.tap(() => this.initializeStateManager(objectDefinitions)),
      IO.tap(() => this.initializeMatcherManager(objectDefinitions)),
      IO.tap(() => logger.info("Initialized")),
    );
  };

// biome-ignore format: composition
export const WithObjectProvider = <T extends ClassType>(Base: T) => compose(
  Base,   
  WithDomObserver,
  WithObjectStateManager,
  WithElementMatcherManager,
  WithApp,
);
