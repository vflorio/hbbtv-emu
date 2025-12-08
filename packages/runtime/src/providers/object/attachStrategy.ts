import { copyProperties, createLogger, insertAfter, ObjectStyleMirror, proxyProperties } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { OipfObject } from "../..";
import type { OipfObjectFactory } from "../../apis/oipfObjectFactory";
import type { AVControlVideo } from "../../av";
import type { OipfApplicationManager } from "../../dae/applicationManager";
import type { OipfCapabilities } from "../../dae/capabilities";
import type { OipfConfiguration } from "../../dae/configuration";
import type { VideoBroadcast } from "../../dae/videoBroadcast";

const logger = createLogger("AttachStrategy");

export type CopyableOipfObjects = OipfApplicationManager | OipfCapabilities | OipfConfiguration;
export type ProxableOipfObjects = AVControlVideo | VideoBroadcast;

/**
 * Copy Strategy - copies all properties from instance to target element.
 *
 * Used for OIPF objects that don't require a video backend:
 * - oipfApplicationManager
 * - oipfConfiguration
 * - oipfCapabilities
 */
export const copyStrategy = (oipfObject: OipfObject, instance: CopyableOipfObjects): IO.IO<void> =>
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
 * Proxy Strategy - proxies properties and sets up video element mirroring.
 *
 * Used for A/V objects that require a video backend:
 * - video/broadcast
 * - video/mp4
 * - application/dash+xml
 */
export const proxyStrategy = (oipfObject: OipfObject, instance: ProxableOipfObjects): IO.IO<void> => {
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
