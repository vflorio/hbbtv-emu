import type * as IO from "fp-ts/IO";
import type * as TE from "fp-ts/TaskEither";

export { DashPlayer } from "./dash";
export { HlsPlayer } from "./hls";
export { HtmlVideoPlayer } from "./video";

export interface Player {
  readonly sourceType: PlayerSourceType;
  readonly videoElement: HTMLVideoElement;

  // Lifecycle
  load(source: PlayerSource): IO.IO<void>;
  release(): IO.IO<void>;
  setupListeners(): IO.IO<void>;

  // Playback control
  play(): TE.TaskEither<Error, void>;
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

export enum PlayerPlayState {
  IDLE = "IDLE",
  CONNECTING = "CONNECTING",
  BUFFERING = "BUFFERING",
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  FINISHED = "FINISHED",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
}

export type PlayerSourceType = "video" | "dash" | "hls";

export type PlayerSource = Readonly<{
  url: string;
  /** Optional to allow VideoStream-level detection */
  type?: PlayerSourceType;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  drm?: {
    system: string;
    licenseUrl: string;
    headers?: Record<string, string>;
  };
}>;

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
    ? { readonly state: PlayerPlayState; readonly previousState: PlayerPlayState }
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
