import type { Stateful } from "@hbb-emu/core";
import type { HbbTVState, OIPF } from "@hbb-emu/oipf";
import type * as IO from "fp-ts/IO";
import type { VideoStream } from "./providers/videoStream/objectVideoStream";

// State slice key in HbbTVState
export type StateKey = keyof HbbTVState;

// copy: Copy properties to element | proxy: Set up video element
export type AttachStrategy = "copy" | "proxy";

// OIPF objects whose properties can be copied to the HTMLObjectElement (non-visual objects)
export type CopyableOipfObject =
  | OIPF.DAE.ApplicationManager.ApplicationManager
  | OIPF.DAE.Capabilities.Capabilities
  | OIPF.DAE.Configuration.Configuration;

// OIPF objects whose properties can be proxied by a VideoStream (A/V objects & VideoBroadcast)
export type ProxableOipfObject =
  | (VideoStream & OIPF.AV.Control.AVControlObject)
  | (VideoStream & OIPF.DAE.Broadcast.VideoBroadcast);

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

export * from "./runtime";
