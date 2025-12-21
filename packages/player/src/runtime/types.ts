/**
 * Types used in the Player Runtime system (Interface Discriminated Unions ADT)
 */
import type { PlaybackType } from "../playback/types";
import type { TimeRange } from "../state/states";

export type PlayerIntentEvent =
  | { readonly _tag: "Intent/LoadRequested"; readonly url: string }
  | { readonly _tag: "Intent/PlayRequested" }
  | { readonly _tag: "Intent/PauseRequested" }
  | { readonly _tag: "Intent/SeekRequested"; readonly time: number };

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

export type PlayerEvent = PlayerIntentEvent | PlayerEngineEvent;

export type PlayerEffect =
  | { readonly _tag: "Effect/DestroyAdapter" }
  | { readonly _tag: "Effect/CreateAdapter"; readonly playbackType: PlaybackType; readonly url: string }
  | { readonly _tag: "Effect/AttachVideoElement" }
  | { readonly _tag: "Effect/LoadSource"; readonly url: string }
  | { readonly _tag: "Effect/Play" }
  | { readonly _tag: "Effect/Pause" }
  | { readonly _tag: "Effect/Seek"; readonly time: number };

export type ReduceResult<TState> = {
  readonly next: TState;
  readonly effects: readonly PlayerEffect[];
};

export type PlayerStateListener<TState> = (state: TState) => void;

export interface PlayerRuntime<TState> {
  getState(): TState;
  getPlaybackType(): PlaybackType | null;
  mount(videoElement: HTMLVideoElement): void;
  destroy(): void;
  dispatch(event: PlayerEvent): void;
  subscribe(listener: PlayerStateListener<TState>): () => void;
}
