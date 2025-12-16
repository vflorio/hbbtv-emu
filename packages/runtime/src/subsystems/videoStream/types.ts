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

export type VideoStreamSourceType = "video" | "dash" | "hls";

export type VideoStreamSource = Readonly<{
  url: string;
  type: VideoStreamSourceType;
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
    ? { readonly state: VideoStreamPlayState; readonly previousState: VideoStreamPlayState }
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
