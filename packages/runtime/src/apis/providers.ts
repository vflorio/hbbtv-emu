/**
 * OIPF Polyfill Definitions
 *
 * This module defines the OIPF polyfills using a clean Reader pattern.
 * Each polyfill is a self-contained module that describes:
 * - How to detect the element (connector)
 * - How to create the instance (factory)
 * - How to manage state (stateful)
 *
 * Every polyfill follows the same pattern: `create*Polyfill(env) => OipfPolyfill`
 * Each has its own environment type, even if empty (using defaults).
 *
 * The `Stateful<S>` constraint eliminates boilerplate for state operations,
 * as all compliant instances automatically provide applyState/getState/subscribe.
 */

import type { Stateful } from "@hbb-emu/core";
import {
  type ApplicationManagerState,
  DEFAULT_APPLICATION_MANAGER,
  DEFAULT_OIPF_CAPABILITIES,
  DEFAULT_OIPF_CONFIGURATION,
  DEFAULT_VIDEO_BROADCAST,
  OIPF,
  type OipfCapabilitiesState,
  type OipfConfigurationState,
  type VideoBroadcastState,
} from "@hbb-emu/oipf";
import type { AttachStrategy, StateKey, VideoBroadcastPolyfillEnv } from "..";
import { OipfApplicationManager } from "./dae/applicationManager";
import { OipfCapabilities } from "./dae/capabilities";
import { OipfConfiguration } from "./dae/configuration";
import { VideoBroadcast } from "./dae/videoBroadcast";
import { createChannelVideoStreamEnv } from "./dae/videoBroadcast/channel";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Connector: describes how to detect and match an element
 */
export type OipfConnector = Readonly<{
  /** CSS selector to find candidate elements */
  selector: string;
  /** Type guard to validate the element */
  predicate: (element: Element) => element is HTMLObjectElement;
  /** Strategy for attaching the polyfill to the element */
  attachStrategy: AttachStrategy;
}>;

/**
 * Factory: creates an instance of the polyfill
 * Using a thunk `() => T` where dependencies are closed over at definition time
 */
export type OipfFactory<T> = () => T;

/**
 * Stateful configuration: describes state management
 * With `T extends Stateful<S>`, we don't need explicit applyState/getState/subscribe
 */
export type OipfStateful<S, K extends StateKey> = Readonly<{
  /** Key in HbbTVState for this polyfill's state slice */
  stateKey: K;
  /** Default state when no persisted state exists */
  defaults: S;
}>;

/**
 * Complete OIPF Polyfill definition
 *
 * The constraint `T extends Stateful<S>` ensures the instance provides:
 * - applyState(state: Partial<S>): IO<void>
 * - getState(): IO<Partial<S>>
 * - subscribe(callback: (state: Partial<S>) => IO<void>): IO<() => void>
 */
export type OipfPolyfill<T extends Stateful<S>, S, K extends StateKey> = Readonly<{
  name: string;
  connector: OipfConnector;
  factory: OipfFactory<T>;
  stateful: OipfStateful<S, K>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Existential wrapper for type-erased polyfill collections
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base interface for any stateful object (type-erased version).
 * Used for collections where we lose specific type information.
 */
interface AnyStateful {
  applyState: (state: Partial<unknown>) => import("fp-ts/IO").IO<void>;
  getState: () => import("fp-ts/IO").IO<Partial<unknown>>;
  subscribe: (callback: (state: Partial<unknown>) => import("fp-ts/IO").IO<void>) => import("fp-ts/IO").IO<() => void>;
}

/**
 * Type-erased polyfill for heterogeneous collections.
 * Use specific `OipfPolyfill<T, S, K>` when type safety is needed.
 */
export type AnyOipfPolyfill = Readonly<{
  name: string;
  connector: OipfConnector;
  factory: () => AnyStateful;
  stateful: Readonly<{
    stateKey: StateKey;
    defaults: unknown;
  }>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Polyfill Environments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Environment for ApplicationManager polyfill.
 * Currently empty - uses defaults. Extensible for future needs.
 */
export type ApplicationManagerPolyfillEnv = Readonly<Record<string, never>>;

/**
 * Environment for Capabilities polyfill.
 * Currently empty - uses defaults. Extensible for future needs.
 */
export type CapabilitiesPolyfillEnv = Readonly<Record<string, never>>;

/**
 * Environment for Configuration polyfill.
 * Currently empty - uses defaults. Extensible for future needs.
 */
export type ConfigurationPolyfillEnv = Readonly<Record<string, never>>;

// VideoBroadcastPolyfillEnv is imported from index.ts

// ─────────────────────────────────────────────────────────────────────────────
// Static Polyfills (environment with defaults)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates the ApplicationManager polyfill
 *
 * @param _env - Environment (currently unused, for future extensibility)
 * @returns ApplicationManager polyfill
 */
export const createApplicationManagerPolyfill = (
  _env: ApplicationManagerPolyfillEnv = {},
): OipfPolyfill<OipfApplicationManager, ApplicationManagerState, "applicationManager"> => ({
  name: "OipfApplicationManager",
  connector: {
    selector: `object[type="${OIPF.DAE.ApplicationManager.MIME_TYPE}"]`,
    predicate: OIPF.DAE.ApplicationManager.isValidElement,
    attachStrategy: "non-visual",
  },
  factory: () => new OipfApplicationManager(),
  stateful: {
    stateKey: "applicationManager",
    defaults: DEFAULT_APPLICATION_MANAGER,
  },
});

/**
 * Creates the Capabilities polyfill
 *
 * @param _env - Environment (currently unused, for future extensibility)
 * @returns Capabilities polyfill
 */
export const createCapabilitiesPolyfill = (
  _env: CapabilitiesPolyfillEnv = {},
): OipfPolyfill<OipfCapabilities, OipfCapabilitiesState, "oipfCapabilities"> => ({
  name: "OipfCapabilities",
  connector: {
    selector: `object[type="${OIPF.DAE.Capabilities.MIME_TYPE}"]`,
    predicate: OIPF.DAE.Capabilities.isValidElement,
    attachStrategy: "non-visual",
  },
  factory: () => new OipfCapabilities(),
  stateful: {
    stateKey: "oipfCapabilities",
    defaults: DEFAULT_OIPF_CAPABILITIES,
  },
});

/**
 * Creates the Configuration polyfill
 *
 * @param _env - Environment (currently unused, for future extensibility)
 * @returns Configuration polyfill
 */
export const createConfigurationPolyfill = (
  _env: ConfigurationPolyfillEnv = {},
): OipfPolyfill<OipfConfiguration, OipfConfigurationState, "oipfConfiguration"> => ({
  name: "OipfConfiguration",
  connector: {
    selector: `object[type="${OIPF.DAE.Configuration.MIME_TYPE}"]`,
    predicate: OIPF.DAE.Configuration.isValidElement,
    attachStrategy: "non-visual",
  },
  factory: () => new OipfConfiguration(),
  stateful: {
    stateKey: "oipfConfiguration",
    defaults: DEFAULT_OIPF_CONFIGURATION,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Polyfills (require runtime environment)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates the VideoBroadcast polyfill with environment closed over
 *
 * @param env - Environment providing channelRegistry and videoStream creation
 * @returns VideoBroadcast polyfill with factory already bound to dependencies
 */
export const createVideoBroadcastPolyfill = (
  env: VideoBroadcastPolyfillEnv,
): OipfPolyfill<VideoBroadcast, VideoBroadcastState, "videoBroadcast"> => ({
  name: "VideoBroadcast",
  connector: {
    selector: `object[type="${OIPF.DAE.Broadcast.MIME_TYPE}"]`,
    predicate: OIPF.DAE.Broadcast.isValidElement,
    attachStrategy: "visual",
  },
  factory: () =>
    new VideoBroadcast({
      channelRegistry: env.channelRegistry,
      videoStream: createChannelVideoStreamEnv(env.createVideoStreamEnv()),
    }),
  stateful: {
    stateKey: "videoBroadcast",
    defaults: DEFAULT_VIDEO_BROADCAST,
  },
});

// TODO: AVControlVideo polyfill
// export type AVControlVideoPolyfillEnv = Readonly<{ ... }>;
// export const createAvControlVideoPolyfill = (env: AVControlVideoPolyfillEnv): OipfPolyfill<...> => ({ ... });

// ─────────────────────────────────────────────────────────────────────────────
// Polyfill Collection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Combined environment for all polyfills that need runtime dependencies.
 * Each polyfill extracts only what it needs from this shared env.
 */
export type PolyfillsEnv = VideoBroadcastPolyfillEnv; // & AVControlVideoPolyfillEnv & ...

/**
 * Creates all OIPF polyfills with the given environment
 *
 * This is the main entry point for the runtime to obtain all polyfill definitions.
 * Each polyfill is created via its own `create*Polyfill(env)` function,
 * making dependencies explicit and semantically clear.
 *
 * @param env - Combined environment for all polyfills
 * @returns Complete list of all OIPF polyfills
 */
export const createPolyfills = (env: PolyfillsEnv): ReadonlyArray<AnyOipfPolyfill> => [
  createApplicationManagerPolyfill() as AnyOipfPolyfill,
  createCapabilitiesPolyfill() as AnyOipfPolyfill,
  createConfigurationPolyfill() as AnyOipfPolyfill,
  createVideoBroadcastPolyfill(env) as AnyOipfPolyfill,
  // TODO: createAvControlVideoPolyfill(env) as AnyOipfPolyfill,
];
