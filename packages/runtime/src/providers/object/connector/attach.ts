import { createLogger, insertAfter, ObjectStyleMirror, proxyProperties } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { AttachStrategy, NonVisualOipfObject, VisualOipfObject } from "../../..";
import type { DetectedElement } from "./";

const logger = createLogger("Attach");

/** Proxy properties to the HTMLObjectElement (non-visual objects) */
export const nonVisualObjectStrategy = (detected: DetectedElement, instance: NonVisualOipfObject): IO.IO<void> =>
  pipe(
    logger.debug("Applying non-visual object strategy to:", detected.mimeType),
    IO.flatMap(() => proxyProperties(detected.element, instance)),
    IO.tap(() => logger.debug("Non-visual object strategy complete for:", detected.mimeType)),
  );

/** Set up VideoStream and proxy properties (visual objects) */
export const visualObjectStrategy = (detected: DetectedElement, instance: VisualOipfObject): IO.IO<void> => {
  const styleMirror = new ObjectStyleMirror(detected.element, instance.videoElement);
  return pipe(
    logger.debug("Applying visual object strategy to:", detected.mimeType),
    IO.flatMap(() => insertAfter(instance.videoElement)(detected.element)),
    IO.flatMap(() => styleMirror.start),
    IO.flatMap(() => proxyProperties(detected.element, instance)),
    IO.tap(() => logger.debug("Visual object strategy complete for:", detected.mimeType)),
  );
};

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

/** Apply the appropriate attach strategy based on definition */
export const applyStrategy = <T>(strategy: AttachStrategy, detected: DetectedElement, instance: T): IO.IO<void> => {
  switch (strategy) {
    case "non-visual":
      return nonVisualObjectStrategy(detected, instance as NonVisualOipfObject);
    case "visual":
      return visualObjectStrategy(detected, instance as VisualOipfObject);
  }
};
