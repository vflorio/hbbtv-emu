/**
 * Object Provider Subsystem
 *
 * Detects OIPF `<object>` elements in the DOM, instantiates the corresponding
 * binding class, attaches it to the DOM element, and maintains a registry
 * for state synchronization.
 *
 * ## Architecture
 *
 * ```
 * provider/
 * ├── polyfill/     # Binding type definitions (data-driven)
 * ├── detection/    # DOM observation and element detection
 * └── registry/     # Instance registry and state sync
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import { createProviderService, createProviderEnv } from "./provider";
 * import { createBindings } from "../apis/bindings";
 *
 * const bindings = createBindings(bindingsEnv);
 * const env = createProviderEnv(bindings, onStateChange);
 * const provider = createProviderService(env);
 *
 * provider.start()();
 * ```
 *
 * ## Key Concepts
 *
 * - **Binding**: Definition of how to detect, create, attach, and sync an OIPF object
 * - **Detection**: MutationObserver-based DOM scanning and element matching
 * - **Registry**: Instance tracking and state change subscription
 * - **Attach Strategy**: How to connect instance to DOM (visual vs non-visual)
 */

// Binding types
export type {
  AnyOipfBinding,
  AnyStateful,
  AttachStrategy,
  OipfBinding,
  OipfConnector,
  OipfFactory,
  OipfStateful,
  StateKey,
  VisualOipfObject,
} from "./binding";
export { isVisualObject } from "./binding";
// Detection
export type { DetectedElement, DetectionHandler, ElementMatcher } from "./detection";
export { applyAttachStrategy, createMatcher, createMatchers, DetectionObserver } from "./detection";
// Provider
export type { ProviderEnv } from "./env";
export { createProviderEnv } from "./env";
export type { ProviderApi } from "./provider";
export { createProviderService, ProviderService } from "./provider";
// Registry
export type { GlobalState, RegistryEntry, RegistryMap, StateChangeCallback } from "./registry";
export { applyExternalState, collectState, InstanceRegistry } from "./registry";
