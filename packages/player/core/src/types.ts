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
  | { readonly _tag: "Intent/SeekRequested"; readonly time: number };

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
  | {
      readonly _tag: "Engine/Error";
      readonly kind: "not-supported" | "network" | "media" | "unknown";
      readonly message: string;
      readonly url?: string;
      readonly cause?: unknown;
    };

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
  | { readonly _tag: "Effect/Seek"; readonly time: number };

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
// Core - Configuration & Interface
// =============================================================================

export type PlayerCoreConfig = Readonly<{
  readonly adapters: Record<PlaybackType, CoreAdapter>;
  readonly onDispatch?: (event: PlayerEvent) => void;
}>;

export interface PlayerCore<T> {
  getState: IO.IO<T>;
  getPlaybackType: IOO.IOOption<PlaybackType>;
  mount: (videoElement: HTMLVideoElement) => T.Task<void>;
  destroy: TE.TaskEither<PlayerCoreError, void>;
  dispatch: (event: PlayerEvent) => T.Task<void>;
  subscribe: (listener: PlayerStateListener<T>) => IO.IO<UnsubscribeFn>;
}

// =============================================================================
// ERRORS - Core Error Types
// =============================================================================

export type PlayerCoreError =
  | { readonly _tag: "CoreError/NoAdapter"; readonly message: string }
  | { readonly _tag: "CoreError/NoVideoElement"; readonly message: string }
  | {
      readonly _tag: "CoreError/AdapterFailure";
      readonly operation: "mount" | "load" | "play" | "pause" | "seek" | "destroy";
      readonly message: string;
      readonly cause?: unknown;
    };

// =============================================================================
// ADAPTERS - Core Adapter Interface
// =============================================================================

export type CoreAdapter = {
  readonly type: PlaybackType;
  readonly name: string;
  mount: (videoElement: HTMLVideoElement) => IO.IO<void>;
  load: (url: string) => T.Task<void>;
  play: T.Task<void>;
  pause: T.Task<void>;
  seek: (time: number) => T.Task<void>;
  destroy: T.Task<void>;
  subscribe: (listener: (event: PlayerEvent) => void) => IO.IO<UnsubscribeFn>;
};

// =============================================================================
// COMMON TYPES - Shared Types & Unions
// =============================================================================

export type PlayerEvent = PlayerIntentEvent | PlayerEngineEvent | PlayerCoreError;

export type PlaybackType = "native" | "hls" | "dash";

export interface PlaybackData<TConfig> {
  readonly source: string;
  readonly config: TConfig;
}
