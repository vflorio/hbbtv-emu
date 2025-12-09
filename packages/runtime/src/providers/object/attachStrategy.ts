import { copyProperties, createLogger, insertAfter, ObjectStyleMirror, proxyProperties } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { CopyableOipfObjects, OipfObject, ProxableOipfObjects } from "../..";
import type { OipfObjectFactory } from "../../apis/objectFactory";

const logger = createLogger("AttachStrategy");

// Copy all properties from instance to target element (OIPF objects)
export const copyStrategy = (oipfObject: OipfObject, instance: CopyableOipfObjects): IO.IO<void> =>
  pipe(
    logger.debug("Applying copy strategy to:", oipfObject.type),
    IO.flatMap(() => copyProperties(instance, oipfObject.element)),
    IO.tap(() => logger.debug("Copy strategy complete for:", oipfObject.type)),
  );

// Inject API instance to window object (e.g. window.oipfObjectFactory)
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

// Proxy properties and set up video element mirroring (A/V objects)
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
