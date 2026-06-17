import type { PlaybackSnapshot, PlaybackType } from "../playback";
import type { PlayerEngineDashEvent } from "./adapter/dash";
import type { PlayerEngineHlsEvent } from "./adapter/hls";
import type { PlayerEngineNativeEvent } from "./adapter/native";

export type PlayerEngineCoreEvent =
  | { readonly _tag: "Engine/Core/Mounted" }
  | {
      readonly _tag: "Engine/Core/MetadataLoaded";
      readonly playbackType: PlaybackType;
      readonly url: string;
      readonly duration: number;
      readonly width: number;
      readonly height: number;
    }
  | { readonly _tag: "Engine/Core/TimeUpdated"; readonly snapshot: PlaybackSnapshot }
  | { readonly _tag: "Engine/Core/Playing"; readonly snapshot: PlaybackSnapshot }
  | { readonly _tag: "Engine/Core/Paused"; readonly snapshot: PlaybackSnapshot }
  | { readonly _tag: "Engine/Core/Waiting"; readonly snapshot: PlaybackSnapshot }
  | { readonly _tag: "Engine/Core/Ended"; readonly snapshot: PlaybackSnapshot }
  | { readonly _tag: "Engine/Core/Seeked"; readonly snapshot: PlaybackSnapshot }
  | { readonly _tag: "Engine/Core/VolumeChanged"; readonly volume: number }
  | { readonly _tag: "Engine/Core/MutedChanged"; readonly muted: boolean }
  | { readonly _tag: "Engine/Core/AutoplayRecoveryAttempted"; readonly muted: boolean };

export type PlayerEngineErrorEvent = {
  readonly _tag: "Engine/Error";
  readonly kind: "not-supported" | "network" | "media" | "decode" | "unknown";
  readonly message: string;
  readonly url?: string;
  readonly codec?: string;
  readonly cause?: unknown;
};

export type PlayerEngineEvent =
  | PlayerEngineCoreEvent
  | PlayerEngineErrorEvent
  // Backends
  | PlayerEngineNativeEvent
  | PlayerEngineDashEvent
  | PlayerEngineHlsEvent;
