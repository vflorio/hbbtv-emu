import type { Stateful } from "@hbb-emu/core";
import type { HbbTVState, OIPF } from "@hbb-emu/oipf";
import type * as IO from "fp-ts/IO";
import type { ChannelRegistryEnv } from "./subsystems/channelRegistry";
import type { VideoStreamEnv } from "./subsystems/videoStream";

export * from "./apis/bindings";
export * from "./runtime.new";
export * from "./subsystems/provider";

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Types (for compatibility during migration)
// ─────────────────────────────────────────────────────────────────────────────

// State slice key in HbbTVState
/** @deprecated Use StateKey from subsystems/provider instead */
export type LegacyStateKey = keyof HbbTVState;

// Definition of attach strategies for OIPF objects
/** @deprecated Use AttachStrategy from subsystems/provider instead */
export type LegacyAttachStrategy = "non-visual" | "visual";

// OIPF objects whose properties can be copied to the HTMLObjectElement (non-visual objects)
export type NonVisualOipfObject =
  | OIPF.DAE.ApplicationManager.ApplicationManager
  | OIPF.DAE.Capabilities.Capabilities
  | OIPF.DAE.Configuration.Configuration;

// Visual objects that have a video element
export interface WithVideoElement {
  readonly videoElement: HTMLVideoElement;
}

// OIPF objects whose properties can be proxied by a VideoStream (A/V objects & VideoBroadcast)
export type VisualOipfObject = WithVideoElement & (OIPF.AV.Control.AVControlObject | OIPF.DAE.Broadcast.VideoBroadcast);

// Factory environment for creating OIPF objects that need runtime dependencies
/** @deprecated Use BindingsEnv from runtime.new instead */
export type VideoBroadcastPolyfillEnv = Readonly<{
  channelRegistry: ChannelRegistryEnv;
  createVideoStreamEnv: () => VideoStreamEnv;
}>;

// Definition for an OIPF object with state sync
/** @deprecated Use OipfBinding from subsystems/provider instead */
export type ObjectDefinition<T extends Stateful<S>, S, K extends LegacyStateKey> = Readonly<{
  name: string;
  selector: string;
  predicate: (element: Element) => element is HTMLObjectElement;
  factory: () => T;
  stateKey: K;
  attachStrategy: LegacyAttachStrategy;
  applyState: (instance: T, state: Partial<S>) => IO.IO<void>;
  getState: (instance: T) => IO.IO<Partial<S>>;
  subscribe: (instance: T, callback: (state: Partial<S>) => IO.IO<void>) => IO.IO<() => void>;
}>;

// Type alias for any OIPF object definition
/** @deprecated Use AnyOipfBinding from subsystems/provider instead */
export type AnyOipfDefinition = ObjectDefinition<any, any, LegacyStateKey>;
