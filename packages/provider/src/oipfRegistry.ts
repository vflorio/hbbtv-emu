/**
 * OIPF Object Registry
 *
 * Centralized definitions for all OIPF/HbbTV objects.
 * Each definition contains:
 * - Selector: CSS selector to find elements in DOM
 * - Predicate: Type guard for validation
 * - Factory: Creates instance
 * - StateKey: Key in HbbTVState for this object's state slice
 * - AttachStrategy: How to attach instance to DOM element
 * - ApplyState: How to apply external state to instance (if bidirectional)
 * - GetState: How to read state from instance (if bidirectional)
 * - Subscribe: How to subscribe to instance changes (if bidirectional)
 */

import {
  Broadcast,
  Control,
  type HbbTVState,
  OIPF,
  type OipfCapabilitiesState,
  type OipfConfigurationState,
  type VideoBroadcastState,
} from "@hbb-emu/core";
import {
  AvVideoBroadcast,
  AvVideoDash,
  AvVideoMp4,
  OipfApplicationManager,
  OipfCapabilities,
  OipfConfiguration,
  type Stateful,
} from "@hbb-emu/hbbtv-api";
import type * as IO from "fp-ts/IO";

/**
 * State slice key in HbbTVState.
 */
export type StateKey = keyof HbbTVState;

/**
 * Attach strategy type.
 * - copy: Copy properties from instance to element (OIPF objects)
 * - proxy: Proxy properties and set up video element (AV objects)
 */
export type AttachStrategy = "copy" | "proxy";

/**
 * Definition for a stateless OIPF object (no state sync).
 */
export type OipfObjectDefinition<T, K extends StateKey> = Readonly<{
  /** Unique name for this object type */
  name: string;

  /** CSS selector to find elements in DOM */
  selector: string;

  /** Type guard for validating elements */
  predicate: (element: Element) => element is HTMLObjectElement;

  /** Factory to create instance */
  factory: () => T;

  /** Key in HbbTVState for this object's state slice */
  stateKey: K;

  /** How to attach instance to DOM element */
  attachStrategy: AttachStrategy;

  /** Whether this object supports bidirectional state sync */
  bidirectional: false;
}>;

/**
 * Definition for a bidirectional OIPF object (supports state sync).
 */
export type OipfBidirectionalDefinition<T extends Stateful<S>, S, K extends StateKey> = Readonly<{
  /** Unique name for this object type */
  name: string;

  /** CSS selector to find elements in DOM */
  selector: string;

  /** Type guard for validating elements */
  predicate: (element: Element) => element is HTMLObjectElement;

  /** Factory to create instance */
  factory: () => T;

  /** Key in HbbTVState for this object's state slice */
  stateKey: K;

  /** How to attach instance to DOM element */
  attachStrategy: AttachStrategy;

  /** Whether this object supports bidirectional state sync */
  bidirectional: true;

  /** Apply external state to instance */
  applyState: (instance: T, state: Partial<S>) => IO.IO<void>;

  /** Get current state from instance */
  getState: (instance: T) => IO.IO<Partial<S>>;

  /** Subscribe to instance state changes */
  subscribe: (instance: T, callback: (state: Partial<S>) => IO.IO<void>) => IO.IO<() => void>;
}>;

/**
 * Union type for all OIPF object definitions.
 */
export type AnyOipfDefinition = OipfObjectDefinition<any, StateKey> | OipfBidirectionalDefinition<any, any, StateKey>;

// ─────────────────────────────────────────────────────────────────────────────
// Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OipfCapabilities definition - bidirectional state sync.
 */
export const oipfCapabilitiesDefinition: OipfBidirectionalDefinition<
  OipfCapabilities,
  OipfCapabilitiesState,
  "oipfCapabilities"
> = {
  name: "OipfCapabilities",
  selector: `object[type="${OIPF.Capabilities.MIME_TYPE}"]`,
  predicate: OIPF.Capabilities.isValidElement,
  factory: () => new OipfCapabilities(),
  stateKey: "oipfCapabilities",
  attachStrategy: "copy",
  bidirectional: true,
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

/**
 * OipfConfiguration definition - bidirectional state sync.
 */
export const oipfConfigurationDefinition: OipfBidirectionalDefinition<
  OipfConfiguration,
  OipfConfigurationState,
  "oipfConfiguration"
> = {
  name: "OipfConfiguration",
  selector: `object[type="${OIPF.Configuration.MIME_TYPE}"]`,
  predicate: OIPF.Configuration.isValidElement,
  factory: () => new OipfConfiguration(),
  stateKey: "oipfConfiguration",
  attachStrategy: "copy",
  bidirectional: true,
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

/**
 * OipfApplicationManager definition - stateless (no external state sync).
 */
export const oipfApplicationManagerDefinition: OipfObjectDefinition<OipfApplicationManager, "applicationManager"> = {
  name: "OipfApplicationManager",
  selector: `object[type="${OIPF.ApplicationManager.MIME_TYPE}"]`,
  predicate: OIPF.ApplicationManager.isValidElement,
  factory: () => new OipfApplicationManager(),
  stateKey: "applicationManager",
  attachStrategy: "copy",
  bidirectional: false,
};

/**
 * AvVideoBroadcast definition - bidirectional state sync.
 */
export const avVideoBroadcastDefinition: OipfBidirectionalDefinition<
  AvVideoBroadcast,
  VideoBroadcastState,
  "videoBroadcast"
> = {
  name: "AvVideoBroadcast",
  selector: `object[type="${Broadcast.VideoBroadcast.MIME_TYPE}"]`,
  predicate: Broadcast.VideoBroadcast.isValidElement,
  factory: () => new AvVideoBroadcast(),
  stateKey: "videoBroadcast",
  attachStrategy: "proxy",
  bidirectional: true,
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

/**
 * AvVideoMp4 definition - stateless for now.
 */
export const avVideoMp4Definition: OipfObjectDefinition<AvVideoMp4, "avControls"> = {
  name: "AvVideoMp4",
  selector: `object[type="${Control.VideoMp4.MIME_TYPE}"]`,
  predicate: Control.VideoMp4.isValidElement,
  factory: () => new AvVideoMp4(),
  stateKey: "avControls",
  attachStrategy: "proxy",
  bidirectional: false,
};

/**
 * AvVideoDash definition - stateless for now.
 */
export const avVideoDashDefinition: OipfObjectDefinition<AvVideoDash, "avControls"> = {
  name: "AvVideoDash",
  selector: `object[type="${Control.VideoDash.MIME_TYPE}"]`,
  predicate: Control.VideoDash.isValidElement,
  factory: () => new AvVideoDash(),
  stateKey: "avControls",
  attachStrategy: "proxy",
  bidirectional: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All bidirectional OIPF object definitions.
 * Used by StateManager for state sync.
 */
export const bidirectionalDefinitions = [
  oipfCapabilitiesDefinition,
  oipfConfigurationDefinition,
  avVideoBroadcastDefinition,
] as const;

/**
 * All OIPF object definitions.
 * Used by matcher system for detection.
 */
export const allDefinitions = [
  oipfCapabilitiesDefinition,
  oipfConfigurationDefinition,
  oipfApplicationManagerDefinition,
  avVideoBroadcastDefinition,
  avVideoMp4Definition,
  avVideoDashDefinition,
] as const;

/**
 * Type helper to extract instance type from definition.
 */
export type InstanceTypeFromDefinition<D> = D extends OipfBidirectionalDefinition<infer T, unknown, StateKey>
  ? T
  : D extends OipfObjectDefinition<infer T, StateKey>
    ? T
    : never;
