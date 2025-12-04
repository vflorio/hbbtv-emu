import { createLogger } from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";

export interface OipfObjectFactory {
  isObjectSupported: (mimeType: string) => boolean;
  createVideoBroadcastObject: () => null;
  createVideoMpegObject: () => null;
  onLowMemory: () => void;
}

export type OipfObjectType =
  | "application/oipfApplicationManager"
  | "application/oipfConfiguration"
  | "application/oipfCapabilities";

export const oipfMimeTypes: OipfObjectType[] = [
  "application/oipfApplicationManager",
  "application/oipfConfiguration",
  "application/oipfCapabilities",
];

export const isValidMimeType = (mimeType: string): mimeType is OipfObjectType =>
  oipfMimeTypes.includes(mimeType as OipfObjectType);

const logger = createLogger("OipfObjectFactory");

export const createObjectFactory = (): OipfObjectFactory => ({
  isObjectSupported: (mimeType: string) =>
    pipe(
      logger.info(`isObjectSupported(${mimeType})`),
      IO.map(() => isValidMimeType(mimeType)),
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
