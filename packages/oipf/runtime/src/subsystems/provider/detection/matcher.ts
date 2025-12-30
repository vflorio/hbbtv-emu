import { createLogger } from "@hbb-emu/core";
import type * as IO from "fp-ts/IO";
import type { AnyOipfBinding } from "../binding";
import type { DetectedElement, ElementMatcher } from "./observer";

const logger = createLogger("DetectionMatcher");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handler called when a binding's element is detected.
 */
export type BindingDetectionHandler = (binding: AnyOipfBinding, detected: DetectedElement) => IO.IO<void>;

// ─────────────────────────────────────────────────────────────────────────────
// Matcher Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an ElementMatcher from a binding definition.
 */
export const createMatcher = (binding: AnyOipfBinding, onDetected: BindingDetectionHandler): ElementMatcher => ({
  selector: binding.connector.selector,
  predicate: binding.connector.predicate,
  onDetected: (detected) => {
    logger.debug(`Detected ${binding.name}:`, detected.mimeType)();
    return onDetected(binding, detected);
  },
});

/**
 * Creates matchers for all bindings.
 */
export const createMatchers = (
  bindings: ReadonlyArray<AnyOipfBinding>,
  onDetected: BindingDetectionHandler,
): ReadonlyArray<ElementMatcher> => bindings.map((b) => createMatcher(b, onDetected));
