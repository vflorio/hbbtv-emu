import { copyProperties, createLogger, insertAfter, ObjectStyleMirror, proxyProperties } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { CopyableOipfObjects, OipfObject, ProxableOipfObjects } from "../../..";
import type { AttachStrategy } from "../../../types";

const logger = createLogger("Attach");

/** Copy all properties from instance to target element (non-visual OIPF objects) */
export const copyStrategy = (oipfObject: OipfObject, instance: CopyableOipfObjects): IO.IO<void> =>
  pipe(
    logger.debug("Applying copy strategy to:", oipfObject.type),
    IO.flatMap(() => copyProperties(instance, oipfObject.element)),
    IO.tap(() => logger.debug("Copy strategy complete for:", oipfObject.type)),
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
export const proxyStrategy = (oipfObject: OipfObject, instance: ProxableOipfObjects): IO.IO<void> => {
  const styleMirror = new ObjectStyleMirror(oipfObject.element, instance.videoElement);
  return pipe(
    logger.debug("Applying proxy strategy to:", oipfObject.type),
    IO.flatMap(() => insertAfter(instance.videoElement)(oipfObject.element)),
    IO.flatMap(() => styleMirror.start),
    IO.flatMap(() => proxyProperties(oipfObject.element, instance)),
    IO.tap(() => logger.debug("Proxy strategy complete for:", oipfObject.type)),
  );
};

/** Apply the appropriate attach strategy based on definition */
export const applyStrategy = <T>(strategy: AttachStrategy, oipfObject: OipfObject, instance: T): IO.IO<void> => {
  switch (strategy) {
    case "copy":
      return copyStrategy(oipfObject, instance as CopyableOipfObjects);
    case "proxy":
      return proxyStrategy(oipfObject, instance as ProxableOipfObjects);
  }
};
