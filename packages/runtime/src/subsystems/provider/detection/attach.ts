import { createLogger } from "@hbb-emu/core";
import type * as IO from "fp-ts/IO";
import { match } from "ts-pattern";
import type { AnyStateful, AttachStrategy, VisualOipfObject } from "../binding";
import { isVisualObject } from "../binding";
import type { DetectedElement } from "./observer";

const logger = createLogger("DetectionAttach");

// ─────────────────────────────────────────────────────────────────────────────
// Attach Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies the attach strategy to connect instance to DOM element.
 */
export const applyAttachStrategy =
  (strategy: AttachStrategy, detected: DetectedElement, instance: AnyStateful): IO.IO<void> =>
  () =>
    match(strategy)
      .with("visual", attachVisual(detected, instance as AnyStateful & VisualOipfObject))
      .with("non-visual", attachNonVisual(detected, instance))
      .exhaustive();

// ─────────────────────────────────────────────────────────────────────────────
// Visual Attach
// ─────────────────────────────────────────────────────────────────────────────

const attachVisual =
  (detected: DetectedElement, instance: AnyStateful & VisualOipfObject): IO.IO<void> =>
  () => {
    logger.debug("Attaching visual element")();

    if (!isVisualObject(instance)) {
      logger.error("Instance does not have videoElement for visual strategy")();
      return;
    }

    // Insert video element after object element
    detected.element.insertAdjacentElement("afterend", instance.videoElement);

    // Mirror styles from object to video
    mirrorStyles(detected.element, instance.videoElement)();

    // Proxy properties
    proxyProperties(detected.element, instance)();
  };

// ─────────────────────────────────────────────────────────────────────────────
// Non-Visual Attach
// ─────────────────────────────────────────────────────────────────────────────

const attachNonVisual =
  (detected: DetectedElement, instance: AnyStateful): IO.IO<void> =>
  () => {
    logger.debug("Attaching non-visual element")();

    // Just proxy properties, no visual element
    proxyProperties(detected.element, instance)();
  };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Proxies properties from instance to DOM element.
 */
const proxyProperties =
  (_element: HTMLObjectElement, _instance: AnyStateful): IO.IO<void> =>
  () => {
    // TODO: Implement property proxying
    // This will copy enumerable properties from instance to element
    logger.debug("Proxying properties to element")();
  };

/**
 * Mirrors styles from source element to target element.
 */
const mirrorStyles =
  (_source: HTMLObjectElement, _target: HTMLVideoElement): IO.IO<void> =>
  () => {
    // TODO: Implement style mirroring
    // This should sync size, position, visibility, etc.
    logger.debug("Mirroring styles")();
  };
