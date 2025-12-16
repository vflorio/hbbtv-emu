import type * as IO from "fp-ts/IO";
import type { PlayerEventListener, PlayerEventType, VideoStreamSource, VideoStreamSourceType } from "../types";

export * as common from "./common";
export * as dashPlayer from "./dash";
export * as hlsPlayer from "./hls";
export * as htmlVideoPlayer from "./video";

/**
 * Common interface for all video player implementations.
 * Eliminates the need for pattern matching on sourceType throughout the codebase.
 */
export interface Player {
  readonly sourceType: VideoStreamSourceType;
  readonly videoElement: HTMLVideoElement;

  // Lifecycle
  load(source: VideoStreamSource): IO.IO<void>;
  release(): IO.IO<void>;
  setupListeners(): IO.IO<void>;

  // Playback control
  play(speed?: number): IO.IO<void>;
  pause(): IO.IO<void>;
  stop(): IO.IO<void>;
  seek(position: number): IO.IO<void>;

  // Audio control
  setVolume(volume: number): IO.IO<void>;
  setMuted(muted: boolean): IO.IO<void>;

  // Display control
  setFullscreen(fullscreen: boolean): IO.IO<void>;
  setSize(width: number, height: number): IO.IO<void>;

  // Event handling
  on<T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void>;
  off<T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void>;
}
