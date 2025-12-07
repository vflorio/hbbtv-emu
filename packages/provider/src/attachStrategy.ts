import { copyProperties, createLogger, insertAfter, ObjectStyleMirror, proxyProperties } from "@hbb-emu/core";
import type {
  AvVideoBroadcast,
  AvVideoDash,
  AvVideoMp4,
  OipfApplicationManager,
  OipfCapabilities,
  OipfConfiguration,
  OipfObjectFactory,
} from "@hbb-emu/hbbtv-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { OipfObject } from ".";

const logger = createLogger("AttachStrategy");

/**
 * Copy Strategy - copies all properties from instance to target element.
 *
 * Used for OIPF objects that don't require a video backend:
 * - oipfApplicationManager
 * - oipfConfiguration
 * - oipfCapabilities
 */
export const copyStrategy = (
  oipfObject: OipfObject,
  instance: OipfApplicationManager | OipfCapabilities | OipfConfiguration,
): IO.IO<void> =>
  pipe(
    logger.debug("Applying copy strategy to:", oipfObject.type),
    IO.flatMap(() => copyProperties(instance, oipfObject.element)),
    IO.tap(() => logger.debug("Copy strategy complete for:", oipfObject.type)),
  );

/**
 * Inject Strategy - injects an API instance into the global window object.
 *
 * Used for:
 * - oipfObjectFactory -> window.oipfObjectFactory
 */
export const injectStrategy = (instance: OipfObjectFactory, key: string): IO.IO<void> =>
  pipe(
    logger.debug("Injecting to window:", key),
    IO.flatMap(() => () => {
      Object.defineProperty(window, key, {
        value: instance,
        writable: false,
        configurable: true,
      });
    }),
    IO.tap(() => logger.debug("Inject strategy complete for:", key)),
  );

/**
 * Interface for AV objects that have a video backend.
 *
 * All AV objects (VideoBroadcast, VideoMp4, VideoDash) share this structure.
 */
export interface AvObjectWithVideoBackend {
  /** Get the underlying HTML video element for playback */
  getVideoElement(): HTMLVideoElement;
}

/**
 * Union of all supported AV object types.
 */
export type AvObject = (AvVideoBroadcast | AvVideoMp4 | AvVideoDash) & AvObjectWithVideoBackend;

/**
 * Proxy Strategy - proxies properties and sets up video element mirroring.
 *
 * Used for A/V objects that require a video backend:
 * - video/broadcast
 * - video/mp4
 * - application/dash+xml
 */
export const proxyStrategy = (oipfObject: OipfObject, instance: AvObject): IO.IO<void> => {
  const videoElement = instance.getVideoElement();
  const styleMirror = new ObjectStyleMirror(oipfObject.element, videoElement);

  return pipe(
    logger.debug("Applying proxy strategy to:", oipfObject.type),
    IO.flatMap(() => insertAfter(videoElement)(oipfObject.element)),
    IO.flatMap(() => styleMirror.start),
    IO.flatMap(() => proxyProperties(oipfObject.element, instance)),
    IO.tap(() => logger.debug("Proxy strategy complete for:", oipfObject.type)),
  );
};
