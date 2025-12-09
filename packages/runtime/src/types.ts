import type { Stateful } from "@hbb-emu/core";
import type { HbbTVState } from "@hbb-emu/oipf";
import type * as IO from "fp-ts/IO";
import type { AVControlVideo } from "./av";
import type { OipfApplicationManager } from "./dae/applicationManager";
import type { OipfCapabilities } from "./dae/capabilities";
import type { OipfConfiguration } from "./dae/configuration";
import type { VideoBroadcast } from "./dae/videoBroadcast";

// State slice key in HbbTVState
export type StateKey = keyof HbbTVState;

// copy: Copy properties to element | proxy: Set up video element
export type AttachStrategy = "copy" | "proxy";

export type CopyableOipfObjects = OipfApplicationManager | OipfCapabilities | OipfConfiguration;

export type ProxableOipfObjects = AVControlVideo | VideoBroadcast;

// Definition for an OIPF object with state sync
export type ObjectDefinition<T extends Stateful<S>, S, K extends StateKey> = Readonly<{
  name: string;
  selector: string;
  predicate: (element: Element) => element is HTMLObjectElement;
  factory: () => T;
  stateKey: K;
  attachStrategy: AttachStrategy;
  applyState: (instance: T, state: Partial<S>) => IO.IO<void>;
  getState: (instance: T) => IO.IO<Partial<S>>;
  subscribe: (instance: T, callback: (state: Partial<S>) => IO.IO<void>) => IO.IO<() => void>;
}>;

// Type alias for any OIPF object definition
export type AnyOipfDefinition = ObjectDefinition<any, any, StateKey>;
