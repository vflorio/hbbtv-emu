/**
 * Types used in the Player Core system (Interface Discriminated Unions ADT)
 */
import type * as IO from "fp-ts/IO";
import type * as IOO from "fp-ts/IOOption";
import type * as T from "fp-ts/Task";
import type * as TE from "fp-ts/TaskEither";
import type { TimeRange } from "./states";

// =============================================================================
// EVENTS - Intent Events (User Actions)
// =============================================================================

export type PlayerIntentEvent =
  | { readonly _tag: "Intent/LoadRequested"; readonly url: string }
  | { readonly _tag: "Intent/PlayRequested" }
  | { readonly _tag: "Intent/PauseRequested" }
  | { readonly _tag: "Intent/SeekRequested"; readonly time: number }
  | { readonly _tag: "Intent/SetVolumeRequested"; readonly volume: number }
  | { readonly _tag: "Intent/SetMutedRequested"; readonly muted: boolean };

// =============================================================================
// EVENTS - Engine Events (Playback Engine Notifications)
// =============================================================================

export type PlaybackSnapshot = {
  readonly currentTime: number;
  readonly duration: number;
  readonly buffered: TimeRange[];
  readonly playbackRate: number;
  readonly paused: boolean;
};

export type PlayerEngineEvent =
  | { readonly _tag: "Engine/Mounted" }
  | {
      readonly _tag: "Engine/MetadataLoaded";
      readonly playbackType: PlaybackType;
      readonly url: string;
      readonly duration: number;
      readonly width: number;
      readonly height: number;
    }
  | { readonly _tag: "Engine/TimeUpdated"; readonly snapshot: PlaybackSnapshot }
  | { readonly _tag: "Engine/Playing"; readonly snapshot: PlaybackSnapshot }
  | { readonly _tag: "Engine/Paused"; readonly snapshot: PlaybackSnapshot }
  | { readonly _tag: "Engine/Waiting"; readonly snapshot: PlaybackSnapshot }
  | { readonly _tag: "Engine/Ended"; readonly snapshot: PlaybackSnapshot }
  | { readonly _tag: "Engine/Seeked"; readonly snapshot: PlaybackSnapshot }
  | { readonly _tag: "Engine/VolumeChanged"; readonly volume: number }
  | { readonly _tag: "Engine/MutedChanged"; readonly muted: boolean }
  | {
      readonly _tag: "Engine/Error";
      readonly kind: "not-supported" | "network" | "media" | "decode" | "unknown";
      readonly message: string;
      readonly url?: string;
      readonly codec?: string;
      readonly cause?: unknown;
    }
  // Native-specific events
  | {
      readonly _tag: "Engine/Native/ProgressiveLoading";
      readonly url: string;
      readonly bytesLoaded: number;
      readonly bytesTotal: number;
      readonly canPlayThrough: boolean;
    }
  // HLS-specific events
  | {
      readonly _tag: "Engine/HLS/ManifestLoading";
      readonly url: string;
    }
  | {
      readonly _tag: "Engine/HLS/ManifestParsed";
      readonly url: string;
      readonly variants: readonly HLSVariantInfo[];
      readonly duration: number;
    }
  | {
      readonly _tag: "Engine/HLS/VariantSelected";
      readonly variant: HLSVariantInfo;
      readonly bandwidth: number;
      readonly resolution: { width: number; height: number };
    }
  | {
      readonly _tag: "Engine/HLS/SegmentLoading";
      readonly segmentIndex: number;
      readonly totalSegments: number;
      readonly currentTime: number;
    }
  | {
      readonly _tag: "Engine/HLS/AdaptiveSwitching";
      readonly fromVariant: HLSVariantInfo;
      readonly toVariant: HLSVariantInfo;
      readonly reason: "bandwidth" | "manual";
    }
  | {
      readonly _tag: "Engine/HLS/ManifestParseError";
      readonly url: string;
      readonly retryCount: number;
      readonly message: string;
      readonly cause?: unknown;
    }
  | {
      readonly _tag: "Engine/HLS/SegmentLoadError";
      readonly segmentIndex: number;
      readonly segmentUrl: string;
      readonly retryCount: number;
      readonly message: string;
      readonly cause?: unknown;
    }
  // DASH-specific events
  | {
      readonly _tag: "Engine/DASH/MPDLoading";
      readonly url: string;
    }
  | {
      readonly _tag: "Engine/DASH/MPDParsed";
      readonly url: string;
      readonly adaptationSets: readonly DASHAdaptationSetInfo[];
      readonly duration: number;
      readonly isDynamic: boolean;
    }
  | {
      readonly _tag: "Engine/DASH/RepresentationSelected";
      readonly representation: DASHRepresentationInfo;
      readonly bandwidth: number;
      readonly resolution: { width: number; height: number };
    }
  | {
      readonly _tag: "Engine/DASH/SegmentDownloading";
      readonly segmentIndex: number;
      readonly mediaType: "video" | "audio";
      readonly bytesLoaded: number;
      readonly bytesTotal: number;
    }
  | {
      readonly _tag: "Engine/DASH/QualitySwitching";
      readonly fromRepresentation: DASHRepresentationInfo;
      readonly toRepresentation: DASHRepresentationInfo;
      readonly reason: "abr" | "manual" | "constraint";
    }
  | {
      readonly _tag: "Engine/DASH/MPDParseError";
      readonly url: string;
      readonly retryCount: number;
      readonly message: string;
      readonly cause?: unknown;
    }
  | {
      readonly _tag: "Engine/DASH/SegmentDownloadError";
      readonly segmentIndex: number;
      readonly mediaType: "video" | "audio";
      readonly retryCount: number;
      readonly message: string;
      readonly cause?: unknown;
    };

// Supporting types for HLS events
export interface HLSVariantInfo {
  readonly bandwidth: number;
  readonly resolution: { width: number; height: number };
  readonly codecs: string;
  readonly url: string;
  readonly frameRate?: number;
}

// Supporting types for DASH events
export interface DASHAdaptationSetInfo {
  readonly id: string;
  readonly contentType: "video" | "audio" | "text";
  readonly mimeType: string;
  readonly representationCount: number;
}

export interface DASHRepresentationInfo {
  readonly id: string;
  readonly bandwidth: number;
  readonly codecs: string;
  readonly resolution?: { width: number; height: number };
  readonly frameRate?: number;
}

// =============================================================================
// EFFECTS - Side Effects to be Executed
// =============================================================================

export type PlayerEffect =
  | { readonly _tag: "Effect/DestroyAdapter" }
  | { readonly _tag: "Effect/CreateAdapter"; readonly playbackType: PlaybackType; readonly url: string }
  | { readonly _tag: "Effect/AttachVideoElement" }
  | { readonly _tag: "Effect/LoadSource"; readonly url: string }
  | { readonly _tag: "Effect/Play" }
  | { readonly _tag: "Effect/Pause" }
  | { readonly _tag: "Effect/Seek"; readonly time: number }
  | { readonly _tag: "Effect/SetVolume"; readonly volume: number }
  | { readonly _tag: "Effect/SetMuted"; readonly muted: boolean };

// =============================================================================
// STATE MANAGEMENT - Reducer & Subscription Types
// =============================================================================

export type ReduceResult<T> = {
  readonly next: T;
  readonly effects: readonly PlayerEffect[];
};

export type PlayerStateListener<T> = (state: T) => void;

export type UnsubscribeFn = () => void;

// =============================================================================
// Runtime - Configuration & Interface
// =============================================================================

export type PlayerRuntimeConfig = Readonly<{
  readonly adapters: Record<PlaybackType, RuntimeAdapter>;
}>;

export type PlayerEventListener = (event: PlayerEvent) => void;

export interface PlayerRuntimeApi<T> {
  getState: IO.IO<T>;
  getPlaybackType: IOO.IOOption<PlaybackType>;
  mount: (videoElement: HTMLVideoElement) => T.Task<void>;
  destroy: TE.TaskEither<PlayerRuntimeError, void>;
  dispatch: (event: PlayerEvent) => T.Task<void>;
  subscribeToState: (listener: PlayerStateListener<T>) => IO.IO<UnsubscribeFn>;
  subscribeToEvents: (listener: PlayerEventListener) => IO.IO<UnsubscribeFn>;
}

// =============================================================================
// ERRORS - Runtime Error Types
// =============================================================================

export type PlayerRuntimeError =
  | { readonly _tag: "CoreError/NoAdapter"; readonly message: string }
  | { readonly _tag: "CoreError/NoVideoElement"; readonly message: string }
  | {
      readonly _tag: "CoreError/AdapterFailure";
      readonly operation: "mount" | "load" | "play" | "pause" | "seek" | "destroy";
      readonly message: string;
      readonly cause?: unknown;
    };

// =============================================================================
// ERRORS - Adapter Error Types
// =============================================================================

export type AdapterError =
  | { readonly _tag: "AdapterError/VideoElementNotMounted"; readonly message: string }
  | {
      readonly _tag: "AdapterError/LoadFailed";
      readonly message: string;
      readonly url: string;
      readonly cause?: unknown;
    }
  | { readonly _tag: "AdapterError/PlayFailed"; readonly message: string; readonly cause?: unknown }
  | { readonly _tag: "AdapterError/PauseFailed"; readonly message: string; readonly cause?: unknown }
  | {
      readonly _tag: "AdapterError/SeekFailed";
      readonly message: string;
      readonly time: number;
      readonly cause?: unknown;
    }
  | { readonly _tag: "AdapterError/DestroyFailed"; readonly message: string; readonly cause?: unknown }
  | { readonly _tag: "AdapterError/NotSupported"; readonly message: string; readonly adapterType: string };

// =============================================================================
// ADAPTERS - Runtime Adapter Interface
// =============================================================================

export type RuntimeAdapter = {
  readonly type: PlaybackType;
  readonly name: string;
  mount: (videoElement: HTMLVideoElement) => IO.IO<void>;
  load: (url: string) => TE.TaskEither<AdapterError, void>;
  play: TE.TaskEither<AdapterError, void>;
  pause: TE.TaskEither<AdapterError, void>;
  seek: (time: number) => TE.TaskEither<AdapterError, void>;
  setVolume: (volume: number) => TE.TaskEither<AdapterError, void>;
  setMuted: (muted: boolean) => TE.TaskEither<AdapterError, void>;
  destroy: TE.TaskEither<AdapterError, void>;
  subscribe: (listener: (event: PlayerEvent) => void) => IO.IO<UnsubscribeFn>;
};

// =============================================================================
// COMMON TYPES - Shared Types & Unions
// =============================================================================

export type PlayerEvent = PlayerIntentEvent | PlayerEngineEvent | PlayerRuntimeError;

export type PlaybackType = "native" | "hls" | "dash";

export interface PlaybackData<TConfig> {
  readonly source: string;
  readonly config: TConfig;
}
