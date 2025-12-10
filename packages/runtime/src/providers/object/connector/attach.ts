import { copyProperties, createLogger, insertAfter, ObjectStyleMirror, proxyProperties } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { AttachStrategy, CopyableOipfObject, ProxableOipfObject } from "../../..";
import type { DetectedElement } from "./";

const logger = createLogger("Attach");

/** Copy all properties from instance to target element (non-visual OIPF objects) */
export const copyStrategy = (detected: DetectedElement, instance: CopyableOipfObject): IO.IO<void> =>
  pipe(
    logger.debug("Applying copy strategy to:", detected.mimeType),
    IO.flatMap(() => copyProperties(instance, detected.element)),
    IO.tap(() => logger.debug("Copy strategy complete for:", detected.mimeType)),
  );

/** Inject API instance to window object (basic OIPF window apis) */
export const injectStrategy = (instance: OIPF.DAE.ObjectFactory.OipfObjectFactory, key: string): IO.IO<void> =>
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

/** Proxy properties and set up video element mirroring (A/V objects) */
export const proxyStrategy = (detected: DetectedElement, instance: ProxableOipfObject): IO.IO<void> => {
  const styleMirror = new ObjectStyleMirror(detected.element, instance.videoElement);
  return pipe(
    logger.debug("Applying proxy strategy to:", detected.mimeType),
    IO.flatMap(() => insertAfter(instance.videoElement)(detected.element)),
    IO.flatMap(() => styleMirror.start),
    IO.flatMap(() => proxyProperties(detected.element, instance)),
    IO.tap(() => logger.debug("Proxy strategy complete for:", detected.mimeType)),
  );
};

/** Apply the appropriate attach strategy based on definition */
export const applyStrategy = <T>(strategy: AttachStrategy, detected: DetectedElement, instance: T): IO.IO<void> => {
  switch (strategy) {
    case "copy":
      return copyStrategy(detected, instance as CopyableOipfObject);
    case "proxy":
      return proxyStrategy(detected, instance as ProxableOipfObject);
  }
};
