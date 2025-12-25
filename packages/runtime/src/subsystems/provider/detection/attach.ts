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
  container: HTMLDivElement;
  styleMirror: ObjectStyleMirror;
}>;

const visualAttachments = new WeakMap<HTMLObjectElement, VisualAttachment>();

export const detachAttachedElement =
  (element: HTMLObjectElement): IO.IO<void> =>
  () => {
    const attachment = visualAttachments.get(element);
    if (!attachment) return;

    attachment.styleMirror.stop();
    attachment.container.remove();
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

const syncInitialProperties =
  (element: HTMLObjectElement, instance: object): IO.IO<void> =>
  () => {
    // Sync properties that were set on the element before detection
    const data = element.getAttribute("data");
    if (data && "data" in instance) {
      logger.debug("Syncing initial data property:", data)();
      (instance as any).data = data;
    }
  };

const attachVisual =
  (detected: DetectedElement, instance: AnyStateful & VisualOipfObject): IO.IO<void> =>
  () => {
    logger.debug("Attaching visual element")();

    if (!isVisualObject(instance)) {
      logger.error("Instance does not have videoElement for visual strategy")();
      return;
    }

    // Create container with position: relative
    const container = document.createElement("div");
    container.setAttribute("data-hbbtv-emu-container", "true");
    container.className = "hbbtv-emu-container";
    container.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
    `;

    container.appendChild(instance.videoElement);

    const styleMirror = new ObjectStyleMirror(detected.element, container);

    visualAttachments.set(detected.element, {
      videoElement: instance.videoElement,
      container,
      styleMirror,
    });

    pipe(
      insertAfter(container)(detected.element),
      IO.flatMap(() => styleMirror.start),
      IO.flatMap(() => proxyProperties(detected.element, instance)),
      IO.flatMap(() => syncInitialProperties(detected.element, instance)),
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
      IO.flatMap(() => syncInitialProperties(detected.element, instance)),
    );
