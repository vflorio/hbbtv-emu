import type { Stateful } from "@hbb-emu/core";
import type * as IO from "fp-ts/IO";

// ─────────────────────────────────────────────────────────────────────────────
// Attach Strategy
// ─────────────────────────────────────────────────────────────────────────────

export type AttachStrategy = "visual" | "non-visual";

// ─────────────────────────────────────────────────────────────────────────────
// State Keys
// ─────────────────────────────────────────────────────────────────────────────

export type StateKey =
  | "applicationManager"
  | "oipfCapabilities"
  | "oipfConfiguration"
  | "videoBroadcast"
  | "avControls";

// ─────────────────────────────────────────────────────────────────────────────
// Connector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Describes how to detect and match an OIPF element in the DOM.
 */
export type OipfConnector = Readonly<{
  /** CSS selector to find candidate elements */
  selector: string;
  /** Type guard to validate the element */
  predicate: (element: Element) => element is HTMLObjectElement;
  /** Strategy for attaching the binding to the element */
  attachStrategy: AttachStrategy;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factory function that creates an instance of the binding.
 * Dependencies are closed over at definition time.
 * The element parameter provides access to the DOM object for extracting
 * properties like event handlers.
 */
export type OipfFactory<T> = (element: HTMLObjectElement) => T;

// ─────────────────────────────────────────────────────────────────────────────
// Binding Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete OIPF Binding definition.
 *
 * The constraint `T extends Stateful<S>` ensures the instance provides:
 * - applyState(state: Partial<S>): IO<void>
 * - getState: IO<Partial<S>>
 * - subscribe(callback: (state: Partial<S>) => IO<void>): IO<() => void>
 */
export type OipfBinding<T extends Stateful<S>, S, K extends StateKey> = Readonly<{
  name: K;
  connector: OipfConnector;
  factory: OipfFactory<T>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Type-Erased Variants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base interface for any stateful object (type-erased version).
 * Used for collections where we lose specific type information.
 */
export interface AnyStateful {
  applyState: (state: Partial<unknown>) => IO.IO<void>;
  getState: IO.IO<Partial<unknown>>;
  subscribe: (callback: (state: Partial<unknown>) => IO.IO<void>) => IO.IO<() => void>;
}

/**
 * Type-erased binding for heterogeneous collections.
 * Use specific `OipfBinding<T, S, K>` when type safety is needed.
 */
export type AnyOipfBinding = Readonly<{
  name: StateKey;
  connector: OipfConnector;
  factory: (element: HTMLObjectElement) => AnyStateful;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Visual Object Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interface for bindings with visual representation.
 * Required for "visual" attach strategy.
 */
export interface VisualOipfObject {
  readonly videoElement: HTMLVideoElement;
}

/**
 * Type guard for visual objects.
 */
export const isVisualObject = (obj: unknown): obj is VisualOipfObject =>
  typeof obj === "object" && obj !== null && "videoElement" in obj;
