import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as RIO from "fp-ts/ReaderIO";
import { match } from "ts-pattern";
import type { PlayerError, PlayerEvent, PlayerEventListener, PlayerEventType, VideoStreamSource } from "../types";
import { VideoStreamPlayState } from "../types";

export type EventListeners = {
  [K in PlayerEventType]: Set<PlayerEventListener<K>>;
};

// Environment

export type PlayerEnv = {
  state: VideoStreamPlayState;
  source: VideoStreamSource | null;
  currentSpeed: number;
  listeners: EventListeners;
  videoElement: HTMLVideoElement;
  setState: (state: VideoStreamPlayState) => IO.IO<void>;
  setSource: (source: VideoStreamSource | null) => IO.IO<void>;
  setCurrentSpeed: (speed: number) => IO.IO<void>;
};

// Methods - Event Emission

export const emit = <T extends PlayerEventType>(
  type: T,
  data: Omit<PlayerEvent<T>, "type" | "timestamp">,
  loggerName: string,
): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.tapIO((env) => () => {
      const event = createPlayerEvent(type, data);
      const logger = createLogger(loggerName);
      for (const listener of env.listeners[type]) {
        try {
          (listener as PlayerEventListener<T>)(event);
        } catch (err) {
          logger.error("Event listener error:", err)();
        }
      }
    }),
    RIO.map(() => undefined),
  );

export const setState = (newState: VideoStreamPlayState, loggerName: string): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.flatMap((env) =>
      match(env.state === newState)
        .with(true, () => RIO.of<PlayerEnv, void>(undefined))
        .with(false, () => {
          const logger = createLogger(loggerName);
          const previousState = env.state;
          return pipe(
            RIO.of<PlayerEnv, void>(undefined),
            RIO.tapIO(() => env.setState(newState)),
            RIO.tapIO(() => logger.debug("State changed:", previousState, "->", newState)),
            RIO.flatMap(() => emit("statechange", { state: newState, previousState }, loggerName)),
          );
        })
        .exhaustive(),
    ),
  );

// Methods - Time/Volume Conversions

export const msToSeconds = (ms: number): number => ms / 1000;

export const secondsToMs = (seconds: number): number => Math.floor(seconds * 1000);

export const clampVolume = (volume: number): number => Math.max(0, Math.min(100, volume));

export const volumeToNormalized = (volume: number): number => clampVolume(volume) / 100;

export const normalizedToVolume = (normalized: number): number => Math.round(normalized * 100);

export const getCurrentTimeMs = (video: HTMLVideoElement): number => secondsToMs(video.currentTime);

export const getDurationMs = (video: HTMLVideoElement): number =>
  Number.isFinite(video.duration) ? secondsToMs(video.duration) : 0;

export const isFullscreen = (element: HTMLVideoElement): boolean => document.fullscreenElement === element;

// Factory Functions

export const createEventListeners = (): EventListeners => ({
  statechange: new Set(),
  timeupdate: new Set(),
  durationchange: new Set(),
  volumechange: new Set(),
  error: new Set(),
  ended: new Set(),
  fullscreenchange: new Set(),
});

export const createPlayerEvent = <T extends PlayerEventType>(
  type: T,
  data: Omit<PlayerEvent<T>, "type" | "timestamp">,
): PlayerEvent<T> => ({ type, timestamp: Date.now(), ...data }) as PlayerEvent<T>;

// Error Factories

export const createVideoError = (video: HTMLVideoElement): PlayerError => ({
  code: video.error?.code ?? 0,
  message: video.error?.message ?? "Unknown error",
});

export const createDashError = (event: unknown): PlayerError => ({
  code: 0,
  message: "DASH playback error",
  details: event,
});

export const createHlsError = (data: { type: string; details: string }): PlayerError => ({
  code: data.details ? 1 : 0,
  message: `HLS error: ${data.type} - ${data.details}`,
  details: data,
});

// Methods - Playback Control

export const loadSourceBase = (source: VideoStreamSource, loggerName: string): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.tapIO(() => createLogger(loggerName).debug("Loading source:", source.url)),
    RIO.tapIO((env) => env.setSource(source)),
    RIO.tapIO((env) => () => {
      env.videoElement.autoplay = source.autoPlay ?? false;
      env.videoElement.muted = source.muted ?? false;
      env.videoElement.loop = source.loop ?? false;
    }),
    RIO.flatMap(() => setState(VideoStreamPlayState.CONNECTING, loggerName)),
  );

export const playBase = (speed: number, loggerName: string): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.tapIO(() => createLogger(loggerName).debug("Play:", speed)),
    RIO.tapIO((env) => env.setCurrentSpeed(speed)),
    RIO.tapIO((env) => () => {
      env.videoElement.playbackRate = Math.abs(speed);
    }),
    RIO.map(() => undefined),
  );

export const pause = (loggerName: string): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.tapIO(() => createLogger(loggerName).debug("Pause")),
    RIO.tapIO((env) => () => env.videoElement.pause()),
    RIO.map(() => undefined),
  );

export const stop = (loggerName: string): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.tapIO(() => createLogger(loggerName).debug("Stop")),
    RIO.tapIO((env) => () => {
      env.videoElement.pause();
      env.videoElement.currentTime = 0;
    }),
    RIO.flatMap(() => setState(VideoStreamPlayState.STOPPED, loggerName)),
  );

export const seek = (position: number, loggerName: string): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.tapIO(() => createLogger(loggerName).debug("Seek:", position)),
    RIO.tapIO((env) => () => {
      const posSeconds = msToSeconds(position);
      if (posSeconds >= 0 && posSeconds <= env.videoElement.duration) {
        env.videoElement.currentTime = posSeconds;
      }
    }),
    RIO.map(() => undefined),
  );

export const releaseBase = (loggerName: string): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.tapIO(() => createLogger(loggerName).debug("Release")),
    RIO.tapIO((env) => () => {
      env.videoElement.pause();
      env.videoElement.removeAttribute("src");
      env.videoElement.load();
    }),
    RIO.tapIO((env) => env.setSource(null)),
    RIO.flatMap(() => setState(VideoStreamPlayState.IDLE, loggerName)),
  );

// Methods - Audio Control

export const setVolume = (volume: number): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.tapIO((env) => () => {
      env.videoElement.volume = volumeToNormalized(volume);
    }),
    RIO.map(() => undefined),
  );

export const setMuted = (muted: boolean): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.tapIO((env) => () => {
      env.videoElement.muted = muted;
    }),
    RIO.map(() => undefined),
  );

// Methods - Display Control

export const setFullscreen = (fullscreen: boolean, loggerName: string): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.tapIO((env) => () => {
      const logger = createLogger(loggerName);
      if (fullscreen && !document.fullscreenElement) {
        env.videoElement.requestFullscreen?.().catch((err: unknown) => {
          logger.warn("Fullscreen request failed:", err)();
        });
      } else if (!fullscreen && document.fullscreenElement === env.videoElement) {
        document.exitFullscreen?.().catch((err: unknown) => {
          logger.warn("Exit fullscreen failed:", err)();
        });
      }
    }),
    RIO.map(() => undefined),
  );

export const setSize = (width: number, height: number): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.tapIO((env) => () => {
      env.videoElement.style.width = `${width}px`;
      env.videoElement.style.height = `${height}px`;
    }),
    RIO.map(() => undefined),
  );

// Methods - Event Subscription

export const on = <T extends PlayerEventType>(
  type: T,
  listener: PlayerEventListener<T>,
): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.tapIO((env) => () => {
      env.listeners[type].add(listener as PlayerEventListener<PlayerEventType>);
    }),
    RIO.map(() => undefined),
  );

export const off = <T extends PlayerEventType>(
  type: T,
  listener: PlayerEventListener<T>,
): RIO.ReaderIO<PlayerEnv, void> =>
  pipe(
    RIO.ask<PlayerEnv>(),
    RIO.tapIO((env) => () => {
      env.listeners[type].delete(listener as PlayerEventListener<PlayerEventType>);
    }),
    RIO.map(() => undefined),
  );
