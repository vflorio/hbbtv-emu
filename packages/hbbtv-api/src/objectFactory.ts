import { createLogger } from "@hbb-emu/lib";
import { VideoBroadcastObject } from "./videoBroadcastObject";

export interface OipfObjectFactory {
  isObjectSupported: (mimeType: string) => boolean;
  createVideoBroadcastObject: () => InstanceType<typeof VideoBroadcastObject>;
  createVideoMpegObject: () => null;
  onLowMemory: () => void;
}

const SUPPORTED_MIME_TYPES = new Set([
  "video/broadcast",
  "video/mpeg",
  "application/oipfApplicationManager",
  "application/oipfCapabilities",
  "application/oipfConfiguration",
  "application/oipfDrmAgent",
  "application/oipfParentalControlManager",
  "application/oipfSearchManager",
]);

const logger = createLogger("OipfObjectFactory");

export const createObjectFactory = (): OipfObjectFactory => ({
  isObjectSupported: (mimeType: string) => {
    logger.log(`isObjectSupported(${mimeType})`);
    return SUPPORTED_MIME_TYPES.has(mimeType);
  },

  createVideoBroadcastObject: () => new VideoBroadcastObject(),

  createVideoMpegObject: () => {
    logger.log("createVideoMpegObject");
    return null;
  },

  onLowMemory: () => {
    logger.log("onLowMemory");
  },
});
