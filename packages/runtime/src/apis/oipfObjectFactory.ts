import { createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RA from "fp-ts/ReadonlyArray";
import { OipfApplicationManager } from "../dae/applicationManager";
import { OipfCapabilities } from "../dae/capabilities";
import { OipfConfiguration } from "../dae/configuration";

const logger = createLogger("OipfObjectFactory");

// ─────────────────────────────────────────────────────────────────────────────
// Supported MIME Types
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Create HTMLObjectElement
// ─────────────────────────────────────────────────────────────────────────────

const createObjectElement = (mimeType: string): IO.IO<HTMLObjectElement> =>
  pipe(
    IO.of(document.createElement("object")),
    IO.tap((el) =>
      IO.of(() => {
        el.type = mimeType;
      }),
    ),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Stub: Not Supported Error
// ─────────────────────────────────────────────────────────────────────────────

const notSupported = (methodName: string): never => {
  throw new TypeError(`${methodName} is not supported`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Object Factory Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class OipfObjectFactory implements OIPF.DAE.ObjectFactory.OipfObjectFactory {
  // ═══════════════════════════════════════════════════════════════════════════
  // Object Support Query
  // ═══════════════════════════════════════════════════════════════════════════

  isObjectSupported = (mimeType: string): boolean =>
    pipe(
      logger.debug("isObjectSupported:", mimeType),
      IO.map(() => isSupportedMimeType(mimeType)),
    )();

  // ═══════════════════════════════════════════════════════════════════════════
  // Visual Objects (HTMLObjectElement)
  // ═══════════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════════
  // HbbTV-specific Visual Objects
  // ═══════════════════════════════════════════════════════════════════════════

  createMediaSynchroniser = (): OIPF.DAE.ObjectFactory.MediaSynchroniser => {
    logger.debug("createMediaSynchroniser")();
    return {};
  };

  createCSManager = (): OIPF.DAE.ObjectFactory.HbbTVCSManager => {
    logger.debug("createCSManager")();
    return {};
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Non-Visual Objects (JavaScript Objects)
  // ═══════════════════════════════════════════════════════════════════════════

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
    // Return a stub ChannelConfig - full implementation requires ChannelList etc.
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Not Implemented Objects (stubs that throw TypeError)
  // ═══════════════════════════════════════════════════════════════════════════

  createCodManagerObject = (): object => notSupported("createCodManagerObject");
  createDownloadManagerObject = (): object => notSupported("createDownloadManagerObject");
  createDownloadTriggerObject = (): object => notSupported("createDownloadTriggerObject");
  createDrmAgentObject = (): object => notSupported("createDrmAgentObject");
  createGatewayInfoObject = (): object => notSupported("createGatewayInfoObject");
  createIMSObject = (): object => notSupported("createIMSObject");
  createMDTFObject = (): object => notSupported("createMDTFObject");
  createNotifSocketObject = (): object => notSupported("createNotifSocketObject");
  createParentalControlManagerObject = (): object => notSupported("createParentalControlManagerObject");
  createRecordingSchedulerObject = (): object => notSupported("createRecordingSchedulerObject");
  createRemoteControlFunctionObject = (): object => notSupported("createRemoteControlFunctionObject");
  createRemoteManagementObject = (): object => notSupported("createRemoteManagementObject");
  createSearchManagerObject = (): object => notSupported("createSearchManagerObject");
}
