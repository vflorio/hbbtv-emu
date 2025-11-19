import { log } from "./utils";
import { VideoBroadcastObject } from "./videoBroadcastObject";

export interface OipfObjectFactory {
  isObjectSupported: (mimeType: string) => boolean;
  createVideoBroadcastObject: () => VideoBroadcastObject;
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

export const createObjectFactory = (): OipfObjectFactory => ({
  isObjectSupported: (mimeType: string) => {
    log(`isObjectSupported(${mimeType})`);
    return SUPPORTED_MIME_TYPES.has(mimeType);
  },

  createVideoBroadcastObject: () => new VideoBroadcastObject(),

  createVideoMpegObject: () => {
    log("createVideoMpegObject");
    return null;
  },

  onLowMemory: () => {
    log("onLowMemory");
  },
});
