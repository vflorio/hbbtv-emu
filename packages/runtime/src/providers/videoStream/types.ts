// ─────────────────────────────────────────────────────────────────────────────
// Play State
// ─────────────────────────────────────────────────────────────────────────────

export enum StreamPlayState {
  IDLE = "IDLE",
  CONNECTING = "CONNECTING",
  BUFFERING = "BUFFERING",
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  FINISHED = "FINISHED",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
}

// ─────────────────────────────────────────────────────────────────────────────
// Media Source Types
// ─────────────────────────────────────────────────────────────────────────────

export type MediaSourceType = "video" | "dash" | "hls";

export type MediaSource = Readonly<{
  url: string;
  type: MediaSourceType;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  drm?: DrmConfig;
}>;

export type DrmConfig = Readonly<{
  system: string;
  licenseUrl: string;
  headers?: Record<string, string>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Player Events
// ─────────────────────────────────────────────────────────────────────────────

export type PlayerEventType =
  | "statechange"
  | "timeupdate"
  | "durationchange"
  | "volumechange"
  | "error"
  | "ended"
  | "fullscreenchange";

export type PlayerEvent<T extends PlayerEventType = PlayerEventType> = Readonly<{
  type: T;
  timestamp: number;
}> &
  (T extends "statechange"
    ? { readonly state: StreamPlayState; readonly previousState: StreamPlayState }
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

export type PlayerError = Readonly<{
  code: number;
  message: string;
  details?: unknown;
}>;

export type PlayerEventListener<T extends PlayerEventType = PlayerEventType> = (event: PlayerEvent<T>) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Player Interface
// ─────────────────────────────────────────────────────────────────────────────

// Abstracts HTMLVideoElement, DASH.js, and HLS.js
export interface Player {
  // State
  readonly state: StreamPlayState;
  readonly source: MediaSource | null;
  readonly currentTime: number;
  readonly duration: number;
  readonly speed: number;
  readonly volume: number;
  readonly muted: boolean;
  readonly fullscreen: boolean;

  // Playback Control
  load(source: MediaSource): void;
  play(speed?: number): void;
  pause(): void;
  stop(): void;
  seek(position: number): void;
  release(): void;

  // Audio Control
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;

  // Display Control
  setFullscreen(fullscreen: boolean): void;
  setSize(width: number, height: number): void;

  // Events
  on<T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): void;
  off<T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): void;

  // Video Element Access
  getElement(): HTMLVideoElement;
}
