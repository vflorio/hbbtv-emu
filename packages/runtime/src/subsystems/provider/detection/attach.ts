import { createLogger, insertAfter, ObjectStyleMirror, proxyProperties } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { match } from "ts-pattern";
import type { AnyStateful, AttachStrategy, VisualOipfObject } from "../binding";
import { isVisualObject } from "../binding";
import type { DetectedElement } from "./observer";

const logger = createLogger("DetectionAttach");

type VisualAttachment = Readonly<{
  videoElement: HTMLVideoElement;
  styleMirror: ObjectStyleMirror;
}>;

const visualAttachments = new WeakMap<HTMLObjectElement, VisualAttachment>();

export const detachAttachedElement =
  (element: HTMLObjectElement): IO.IO<void> =>
  () => {
    const attachment = visualAttachments.get(element);
    if (!attachment) return;

    attachment.styleMirror.stop();
    attachment.videoElement.remove();
    visualAttachments.delete(element);
  };

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

    const styleMirror = new ObjectStyleMirror(detected.element, instance.videoElement);

    visualAttachments.set(detected.element, {
      videoElement: instance.videoElement,
      styleMirror,
    });

    pipe(
      insertAfter(instance.videoElement)(detected.element),
      IO.flatMap(() => styleMirror.start),
      IO.flatMap(() => proxyProperties(detected.element, instance)),
    )();
  };

// ─────────────────────────────────────────────────────────────────────────────
// Non-Visual Attach
// ─────────────────────────────────────────────────────────────────────────────

const attachNonVisual =
  (detected: DetectedElement, instance: AnyStateful): IO.IO<void> =>
  () =>
    pipe(
      logger.debug("Attaching non-visual element"),
      IO.flatMap(() => proxyProperties(detected.element, instance)),
    );
