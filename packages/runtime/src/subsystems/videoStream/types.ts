/**
 * Play state of the video stream
 * Maps to HbbTV/OIPF play states
 */
export enum VideoStreamPlayState {
  IDLE = "IDLE",
  CONNECTING = "CONNECTING",
  BUFFERING = "BUFFERING",
  PLAYING = "PLAYING",
  PAUSED = "PAUSED",
  FINISHED = "FINISHED",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
}

/**
 * Video source configuration
 */
export type VideoStreamSource = Readonly<{
  url: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  drm?: {
    system: string;
    licenseUrl: string;
    headers?: Record<string, string>;
  };
}>;

/**
 * Event types emitted by VideoStream
 */
export type VideoStreamEventType =
  | "statechange"
  | "timeupdate"
  | "durationchange"
  | "volumechange"
  | "error"
  | "ended"
  | "fullscreenchange";

/**
 * Base event structure
 */
export type VideoStreamEvent<T extends VideoStreamEventType = VideoStreamEventType> = Readonly<{
  type: T;
  timestamp: number;
}> &
  (T extends "statechange"
    ? { readonly state: VideoStreamPlayState; readonly previousState: VideoStreamPlayState }
    : T extends "timeupdate"
      ? { readonly currentTime: number }
      : T extends "durationchange"
        ? { readonly duration: number }
        : T extends "volumechange"
          ? { readonly volume: number; readonly muted: boolean }
          : T extends "error"
            ? { readonly error: VideoStreamError }
            : T extends "fullscreenchange"
              ? { readonly fullscreen: boolean }
              : object);

/**
 * Error information
 */
export type VideoStreamError = Readonly<{
  code: number;
  message: string;
  details?: unknown;
}>;

/**
 * Event listener callback
 */
export type VideoStreamEventListener<T extends VideoStreamEventType = VideoStreamEventType> = (
  event: VideoStreamEvent<T>,
) => void;
