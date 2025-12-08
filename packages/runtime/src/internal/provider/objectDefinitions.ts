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
 * - ApplyState: How to apply external state to instance
 * - GetState: How to read state from instance
 * - Subscribe: How to subscribe to instance changes
 */

import {
  type ApplicationManagerState,
  type AVControlState,
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
 * Definition for an OIPF object
 * All OIPF objects support state sync between the extension and the page.
 */
export type ObjectDefinition<T extends Stateful<S>, S, K extends StateKey> = Readonly<{
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

  /** Apply external state to instance */
  applyState: (instance: T, state: Partial<S>) => IO.IO<void>;

  /** Get current state from instance */
  getState: (instance: T) => IO.IO<Partial<S>>;

  /** Subscribe to instance state changes */
  subscribe: (instance: T, callback: (state: Partial<S>) => IO.IO<void>) => IO.IO<() => void>;
}>;

/**
 * Type alias for any OIPF object definition.
 * Uses `any` for instance/state types since definitions are heterogeneous.
 */
export type AnyOipfDefinition = ObjectDefinition<any, any, StateKey>;

// ─────────────────────────────────────────────────────────────────────────────
// Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OipfCapabilities definition.
 */
export const oipfCapabilitiesDefinition: ObjectDefinition<OipfCapabilities, OipfCapabilitiesState, "oipfCapabilities"> =
  {
    name: "OipfCapabilities",
    selector: `object[type="${OIPF.Capabilities.MIME_TYPE}"]`,
    predicate: OIPF.Capabilities.isValidElement,
    factory: () => new OipfCapabilities(),
    stateKey: "oipfCapabilities",
    attachStrategy: "copy",
    applyState: (instance, state) => instance.applyState(state ?? {}),
    getState: (instance) => instance.getState(),
    subscribe: (instance, callback) => instance.subscribe(callback),
  };

/**
 * OipfConfiguration definition.
 */
export const oipfConfigurationDefinition: ObjectDefinition<
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
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

/**
 * OipfApplicationManager definition.
 */
export const oipfApplicationManagerDefinition: ObjectDefinition<
  OipfApplicationManager,
  ApplicationManagerState,
  "applicationManager"
> = {
  name: "OipfApplicationManager",
  selector: `object[type="${OIPF.ApplicationManager.MIME_TYPE}"]`,
  predicate: OIPF.ApplicationManager.isValidElement,
  factory: () => new OipfApplicationManager(),
  stateKey: "applicationManager",
  attachStrategy: "copy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

/**
 * AvVideoBroadcast definition.
 */
export const avVideoBroadcastDefinition: ObjectDefinition<AvVideoBroadcast, VideoBroadcastState, "videoBroadcast"> = {
  name: "AvVideoBroadcast",
  selector: `object[type="${Broadcast.VideoBroadcast.MIME_TYPE}"]`,
  predicate: Broadcast.VideoBroadcast.isValidElement,
  factory: () => new AvVideoBroadcast(),
  stateKey: "videoBroadcast",
  attachStrategy: "proxy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

/**
 * AvVideoMp4 definition.
 */
export const avVideoMp4Definition: ObjectDefinition<AvVideoMp4, AVControlState, "avControls"> = {
  name: "AvVideoMp4",
  selector: `object[type="${Control.VideoMp4.MIME_TYPE}"]`,
  predicate: Control.VideoMp4.isValidElement,
  factory: () => new AvVideoMp4(),
  stateKey: "avControls",
  attachStrategy: "proxy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

/**
 * AvVideoDash definition.
 */
export const avVideoDashDefinition: ObjectDefinition<AvVideoDash, AVControlState, "avControls"> = {
  name: "AvVideoDash",
  selector: `object[type="${Control.VideoDash.MIME_TYPE}"]`,
  predicate: Control.VideoDash.isValidElement,
  factory: () => new AvVideoDash(),
  stateKey: "avControls",
  attachStrategy: "proxy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const objectDefinitions = [
  oipfCapabilitiesDefinition,
  oipfConfigurationDefinition,
  oipfApplicationManagerDefinition,
  avVideoBroadcastDefinition,
  avVideoMp4Definition,
  avVideoDashDefinition,
] as const;
