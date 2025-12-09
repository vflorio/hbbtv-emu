import type { Stateful } from "@hbb-emu/core";
import type { HbbTVState } from "@hbb-emu/oipf";
import type * as IO from "fp-ts/IO";
import type { AVControlVideo } from "./av";
import type { OipfApplicationManager } from "./dae/applicationManager";
import type { OipfCapabilities } from "./dae/capabilities";
import type { OipfConfiguration } from "./dae/configuration";
import type { VideoBroadcast } from "./dae/videoBroadcast";

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

export type CopyableOipfObjects = OipfApplicationManager | OipfCapabilities | OipfConfiguration;

export type ProxableOipfObjects = AVControlVideo | VideoBroadcast;

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
