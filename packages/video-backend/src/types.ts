/**
 * Video Backend Types
 *
 * Unified types for low-level video playback backend.
 * This module contains only video-related types, no HbbTV-specific logic.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Unified Play State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unified play state for the video backend.
 *
 * This is the internal representation used by the player.
 * HbbTV-specific state mapping should be done in the consuming classes.
 */
export enum UnifiedPlayState {
  /** Not started or released */
  IDLE = "IDLE",
  /** Connecting to media source */
  CONNECTING = "CONNECTING",
  /** Buffering data */
  BUFFERING = "BUFFERING",
  /** Media is playing */
  PLAYING = "PLAYING",
  /** Media is paused */
  PAUSED = "PAUSED",
  /** Playback finished */
  FINISHED = "FINISHED",
  /** Playback stopped by user */
  STOPPED = "STOPPED",
  /** Error occurred */
  ERROR = "ERROR",
}

// ─────────────────────────────────────────────────────────────────────────────
// Media Source Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type of media source being played.
 */
export type MediaSourceType = "native" | "dash" | "hls" | "broadcast";

/**
 * Media source configuration.
 */
export type MediaSource = Readonly<{
  /** URL of the media source */
  url: string;
  /** Type of media source (auto-detected if not provided) */
  type?: MediaSourceType;
  /** Optional DRM configuration */
  drm?: DrmConfig;
}>;

/**
 * DRM configuration for protected content.
 */
export type DrmConfig = Readonly<{
  /** DRM system identifier (e.g., "com.widevine.alpha") */
  system: string;
  /** License server URL */
  licenseUrl: string;
  /** Optional additional headers */
  headers?: Record<string, string>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Player Events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Player event types.
 */
export type PlayerEventType =
  | "statechange"
  | "timeupdate"
  | "durationchange"
  | "volumechange"
  | "error"
  | "ended"
  | "fullscreenchange";

/**
 * Player event data.
 */
export type PlayerEvent<T extends PlayerEventType = PlayerEventType> = Readonly<{
  type: T;
  timestamp: number;
}> &
  (T extends "statechange"
    ? { readonly state: UnifiedPlayState; readonly previousState: UnifiedPlayState }
    : T extends "timeupdate"
      ? { readonly currentTime: number }
      : T extends "durationchange"
        ? { readonly duration: number }
        : T extends "volumechange"
          ? { readonly volume: number; readonly muted: boolean }
          : T extends "error"
            ? { readonly error: PlayerError }
            : T extends "fullscreenchange"
              ? { readonly fullscreen: boolean }
              : object);

/**
 * Player error information.
 */
export type PlayerError = Readonly<{
  code: number;
  message: string;
  details?: unknown;
}>;

/**
 * Player event listener.
 */
export type PlayerEventListener<T extends PlayerEventType = PlayerEventType> = (event: PlayerEvent<T>) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Player Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unified player interface that abstracts HTMLVideoElement, DASH.js, and HLS.js.
 */
export interface Player {
  // ─── State ─────────────────────────────────────────────────────────────────
  /** Current play state */
  readonly state: UnifiedPlayState;
  /** Current media source */
  readonly source: MediaSource | null;
  /** Current playback position in milliseconds */
  readonly currentTime: number;
  /** Media duration in milliseconds */
  readonly duration: number;
  /** Current playback speed (1.0 = normal) */
  readonly speed: number;
  /** Volume level (0-100) */
  readonly volume: number;
  /** Muted state */
  readonly muted: boolean;
  /** Fullscreen state */
  readonly fullscreen: boolean;

  // ─── Playback Control ──────────────────────────────────────────────────────
  /** Load media source */
  load(source: MediaSource): void;
  /** Start or resume playback */
  play(speed?: number): void;
  /** Pause playback */
  pause(): void;
  /** Stop playback and reset position */
  stop(): void;
  /** Seek to position (milliseconds) */
  seek(position: number): void;
  /** Release all resources */
  release(): void;

  // ─── Audio Control ─────────────────────────────────────────────────────────
  /** Set volume (0-100) */
  setVolume(volume: number): void;
  /** Set muted state */
  setMuted(muted: boolean): void;

  // ─── Display Control ───────────────────────────────────────────────────────
  /** Set fullscreen state */
  setFullscreen(fullscreen: boolean): void;
  /** Set dimensions */
  setSize(width: number, height: number): void;

  // ─── Events ────────────────────────────────────────────────────────────────
  /** Add event listener */
  on<T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): void;
  /** Remove event listener */
  off<T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): void;

  // ─── Video Element Access ──────────────────────────────────────────────────
  /** Get underlying video element (for DOM attachment) */
  getVideoElement(): HTMLVideoElement;
}
