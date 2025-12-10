import { createLogger, notImplementedError } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import * as RA from "fp-ts/ReadonlyArray";
import { OipfApplicationManager } from "../dae/applicationManager";
import { OipfCapabilities } from "../dae/capabilities";
import { OipfConfiguration } from "../dae/configuration";
import { injectStrategy } from "../providers/object/attachStrategy";

const logger = createLogger("OipfObjectFactory");

// API Implementation

export class OipfObjectFactory implements OIPF.DAE.ObjectFactory.OipfObjectFactory {
  isObjectSupported = (mimeType: string): boolean =>
    pipe(
      logger.debug("isObjectSupported:", mimeType),
      IO.map(() => isSupportedMimeType(mimeType)),
    )();

  // Visual Objects (HTMLObjectElement)

  createVideoBroadcastObject = (_requiredCapabilities?: readonly string[]): HTMLObjectElement | null =>
    pipe(
      logger.debug("createVideoBroadcastObject"),
      IO.flatMap(() => createObjectElement("video/broadcast")),
    )();

  createVideoMpegObject = (_requiredCapabilities?: readonly string[]): HTMLObjectElement | null =>
    pipe(
      logger.debug("createVideoMpegObject"),
      IO.flatMap(() => createObjectElement("video/mpeg")),
    )();

  createStatusViewObject = (): HTMLObjectElement =>
    pipe(
      logger.debug("createStatusViewObject"),
      IO.flatMap(() => createObjectElement("application/oipfStatusView")),
    )();

  // HbbTV-specific Visual Objects

  createMediaSynchroniser = (): OIPF.DAE.ObjectFactory.MediaSynchroniser => {
    logger.debug("createMediaSynchroniser")();
    return {};
  };

  createCSManager = (): OIPF.DAE.ObjectFactory.HbbTVCSManager => {
    logger.debug("createCSManager")();
    return {};
  };

  // Non-Visual Objects (JavaScript Objects)

  createApplicationManagerObject = (): OIPF.DAE.ApplicationManager.ApplicationManager => {
    logger.debug("createApplicationManagerObject")();
    return new OipfApplicationManager();
  };

  createCapabilitiesObject = (): OIPF.DAE.Capabilities.Capabilities => {
    logger.debug("createCapabilitiesObject")();
    return new OipfCapabilities();
  };

  createChannelConfig = (): OIPF.DAE.Broadcast.ChannelConfig => {
    logger.debug("createChannelConfig")();
    // TODO Return a stub ChannelConfig - full implementation requires ChannelList etc.
    return {
      channelList: { length: 0, item: () => null },
      favouriteLists: { length: 0, getFavouriteList: () => null },
      currentFavouriteList: null,
      getChannelByTriplet: () => null,
    } as unknown as OIPF.DAE.Broadcast.ChannelConfig;
  };

  createConfigurationObject = (): OIPF.DAE.Configuration.Configuration => {
    logger.debug("createConfigurationObject")();
    return new OipfConfiguration();
  };

  // Not Implemented Objects

  createCodManagerObject = (): object => notImplementedError("createCodManagerObject");
  createDownloadManagerObject = (): object => notImplementedError("createDownloadManagerObject");
  createDownloadTriggerObject = (): object => notImplementedError("createDownloadTriggerObject");
  createDrmAgentObject = (): object => notImplementedError("createDrmAgentObject");
  createGatewayInfoObject = (): object => notImplementedError("createGatewayInfoObject");
  createIMSObject = (): object => notImplementedError("createIMSObject");
  createMDTFObject = (): object => notImplementedError("createMDTFObject");
  createNotifSocketObject = (): object => notImplementedError("createNotifSocketObject");
  createParentalControlManagerObject = (): object => notImplementedError("createParentalControlManagerObject");
  createRecordingSchedulerObject = (): object => notImplementedError("createRecordingSchedulerObject");
  createRemoteControlFunctionObject = (): object => notImplementedError("createRemoteControlFunctionObject");
  createRemoteManagementObject = (): object => notImplementedError("createRemoteManagementObject");
  createSearchManagerObject = (): object => notImplementedError("createSearchManagerObject");
}

const SUPPORTED_MIME_TYPES: ReadonlyArray<OIPF.DAE.ObjectFactory.ObjectFactoryMimeType> = [
  "application/oipfApplicationManager",
  "application/oipfCapabilities",
  "application/oipfConfiguration",
  "video/broadcast",
];

const isSupportedMimeType = (mimeType: string): boolean =>
  pipe(
    SUPPORTED_MIME_TYPES,
    RA.some((supported) => supported === mimeType),
  );

const createObjectElement = (mimeType: string): IO.IO<HTMLObjectElement> =>
  pipe(
    IO.of(document.createElement("object")),
    IO.tap((el) =>
      IO.of(() => {
        el.type = mimeType;
      }),
    ),
  );

// Provider

export type OipfObjectFactoryEnv = {
  getOipfObjectFactory: IO.IO<OIPF.DAE.ObjectFactory.OipfObjectFactory>;
};

export const initializeOipfObjectFactory: RIO.ReaderIO<OipfObjectFactoryEnv, void> = (env) =>
  pipe(
    env.getOipfObjectFactory,
    IO.flatMap((factory) => injectStrategy(factory, "oipfObjectFactory")),
  );

export const createOipfObjectFactoryEnv = (): OipfObjectFactoryEnv => ({
  getOipfObjectFactory: IO.of(new OipfObjectFactory()),
});
