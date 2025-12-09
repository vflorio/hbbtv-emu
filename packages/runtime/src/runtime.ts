import { type ClassType, compose, createLogger } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { initializeOipfObjectFactory } from "./apis/objectFactory";
import { initializeUserAgent } from "./apis/userAgent";
import { avVideoDashDefinition, avVideoMp4Definition } from "./av";
import { oipfApplicationManagerDefinition } from "./dae/applicationManager";
import { oipfCapabilitiesDefinition } from "./dae/capabilities";
import { oipfConfigurationDefinition } from "./dae/configuration";
import { videoBroadcastDefinition } from "./dae/videoBroadcast";
import { type ObjectProvider, WithObjectProvider } from "./providers/object/objectProvider";

export const objectDefinitions = [
  oipfCapabilitiesDefinition,
  oipfConfigurationDefinition,
  oipfApplicationManagerDefinition,
  videoBroadcastDefinition,
  avVideoMp4Definition,
  avVideoDashDefinition,
] as const;

const logger = createLogger("Provider");

const WithApp = <T extends ClassType<ObjectProvider>>(Base: T) =>
  class extends Base {
    initialize = (extensionState: ExtensionState) =>
      pipe(
        logger.info("Initializing"),
        IO.tap(() => initializeUserAgent(extensionState)),
        IO.tap(() => initializeOipfObjectFactory),
        IO.tap(() => this.initializeProvider),
        IO.tap(() => logger.info("Initialized")),
      );
  };

// biome-ignore format: composition
export const Runtime = compose(
  class {},
  WithObjectProvider,
  WithApp,
);

export type Instance = InstanceType<typeof Runtime>;
