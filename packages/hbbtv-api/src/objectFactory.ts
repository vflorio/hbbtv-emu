import { createLogger } from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";

export interface OipfObjectFactory {
  isObjectSupported: (mimeType: string) => boolean;
  createVideoBroadcastObject: () => null;
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
  isObjectSupported: (mimeType: string) =>
    pipe(
      logger.info(`isObjectSupported(${mimeType})`),
      IO.map(() => SUPPORTED_MIME_TYPES.has(mimeType)),
    )(),

  createVideoBroadcastObject: () =>
    pipe(
      logger.info("createVideoBroadcastObject"),
      IO.map(() => null),
    )(),

  createVideoMpegObject: () =>
    pipe(
      logger.info("createVideoMpegObject"),
      IO.map(() => null),
    )(),

  onLowMemory: () => logger.info("onLowMemory")(),
});
