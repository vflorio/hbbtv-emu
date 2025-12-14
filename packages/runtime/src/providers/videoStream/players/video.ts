// HTML Video Player - native HTMLVideoElement implementation

import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as RIO from "fp-ts/ReaderIO";
import { match } from "ts-pattern";
import type { MediaSource, PlayerEventListener, PlayerEventType } from "../types";
import { StreamPlayState } from "../types";
import type { Player } from ".";
import {
  createEventListeners,
  createVideoError,
  type EventListeners,
  emit,
  getCurrentTimeMs,
  getDurationMs,
  isFullscreen,
  loadSourceBase,
  normalizedToVolume,
  off,
  on,
  type PlayerEnv,
  pause,
  playBase,
  releaseBase,
  seek,
  setFullscreen,
  setMuted,
  setSize,
  setState,
  setVolume,
  stop,
} from "./common";

const LOGGER_NAME = "HtmlVideoPlayer";
const logger = createLogger(LOGGER_NAME);

// State

export type HtmlVideoPlayerState = {
  state: StreamPlayState;
  source: MediaSource | null;
  currentSpeed: number;
  videoElement: HTMLVideoElement;
  listeners: EventListeners;
};

export const createHtmlVideoPlayerState = (): HtmlVideoPlayerState => ({
  state: StreamPlayState.IDLE,
  source: null,
  currentSpeed: 1,
  videoElement: document.createElement("video"),
  listeners: createEventListeners(),
});

// Environment

export type HtmlVideoPlayerEnv = PlayerEnv;

export const createHtmlVideoPlayerEnv = (state: HtmlVideoPlayerState): HtmlVideoPlayerEnv => ({
  state: state.state,
  source: state.source,
  currentSpeed: state.currentSpeed,
  listeners: state.listeners,
  videoElement: state.videoElement,
  setState: (newState: StreamPlayState) => () => {
    state.state = newState;
  },
  setSource: (source: MediaSource | null) => () => {
    state.source = source;
  },
  setCurrentSpeed: (speed: number) => () => {
    state.currentSpeed = speed;
  },
});

// Methods

export const setupVideoEventListeners: RIO.ReaderIO<HtmlVideoPlayerEnv, void> = pipe(
  RIO.ask<HtmlVideoPlayerEnv>(),
  RIO.flatMapIO((env) => () => {
    env.videoElement.addEventListener("loadstart", () => {
      match(env.state)
        .with(StreamPlayState.IDLE, () => setState(StreamPlayState.CONNECTING, LOGGER_NAME)(env)())
        .otherwise(() => {});
    });

    env.videoElement.addEventListener("playing", () => {
      setState(StreamPlayState.PLAYING, LOGGER_NAME)(env)();
    });

    env.videoElement.addEventListener("pause", () => {
      match(env.state)
        .with(StreamPlayState.PLAYING, () => setState(StreamPlayState.PAUSED, LOGGER_NAME)(env)())
        .otherwise(() => {});
    });

    env.videoElement.addEventListener("waiting", () => {
      match(env.state)
        .with(StreamPlayState.PLAYING, () => setState(StreamPlayState.BUFFERING, LOGGER_NAME)(env)())
        .otherwise(() => {});
    });

    env.videoElement.addEventListener("ended", () => {
      pipe(
        setState(StreamPlayState.FINISHED, LOGGER_NAME),
        RIO.flatMap(() => emit("ended", {}, LOGGER_NAME)),
      )(env)();
    });

    env.videoElement.addEventListener("error", () => {
      pipe(
        setState(StreamPlayState.ERROR, LOGGER_NAME),
        RIO.flatMap(() => emit("error", { error: createVideoError(env.videoElement) }, LOGGER_NAME)),
      )(env)();
    });

    env.videoElement.addEventListener("timeupdate", () => {
      emit("timeupdate", { currentTime: getCurrentTimeMs(env.videoElement) }, LOGGER_NAME)(env)();
    });

    env.videoElement.addEventListener("durationchange", () => {
      if (Number.isFinite(env.videoElement.duration)) {
        emit("durationchange", { duration: getDurationMs(env.videoElement) }, LOGGER_NAME)(env)();
      }
    });

    env.videoElement.addEventListener("volumechange", () => {
      emit(
        "volumechange",
        {
          volume: normalizedToVolume(env.videoElement.volume),
          muted: env.videoElement.muted,
        },
        LOGGER_NAME,
      )(env)();
    });

    document.addEventListener("fullscreenchange", () => {
      emit("fullscreenchange", { fullscreen: isFullscreen(env.videoElement) }, LOGGER_NAME)(env)();
    });
  }),
);

export const load = (source: MediaSource): RIO.ReaderIO<HtmlVideoPlayerEnv, void> =>
  pipe(
    loadSourceBase(source, LOGGER_NAME),
    RIO.flatMap(() =>
      pipe(
        RIO.ask<HtmlVideoPlayerEnv>(),
        RIO.flatMapIO((env) => () => {
          env.videoElement.src = source.url;
          env.videoElement.load();
        }),
      ),
    ),
  );

export const play = (speed: number): RIO.ReaderIO<HtmlVideoPlayerEnv, void> =>
  pipe(
    playBase(speed, LOGGER_NAME),
    RIO.flatMap(() =>
      pipe(
        RIO.ask<HtmlVideoPlayerEnv>(),
        RIO.flatMapIO((env) => () => {
          match(speed)
            .with(0, () => env.videoElement.pause())
            .otherwise(() => {
              env.videoElement.play().catch((err: unknown) => {
                logger.error("Play failed:", err)();
                pipe(
                  setState(StreamPlayState.ERROR, LOGGER_NAME),
                  RIO.flatMap(() => emit("error", { error: { code: 0, message: String(err) } }, LOGGER_NAME)),
                )(env)();
              });
            });
        }),
      ),
    ),
  );

export const release: RIO.ReaderIO<HtmlVideoPlayerEnv, void> = releaseBase(LOGGER_NAME);

export class HtmlVideoPlayer implements Player {
  readonly sourceType = "video" as const;
  readonly videoElement: HTMLVideoElement;

  readonly #env: HtmlVideoPlayerEnv;
  #state: StreamPlayState = StreamPlayState.IDLE;
  #source: MediaSource | null = null;
  #currentSpeed = 1;

  constructor() {
    this.videoElement = document.createElement("video");

    this.#env = {
      state: this.#state,
      source: this.#source,
      currentSpeed: this.#currentSpeed,
      listeners: createEventListeners(),
      videoElement: this.videoElement,
      setState: (newState) => () => {
        this.#state = newState;
        this.#env.state = newState;
      },
      setSource: (source) => () => {
        this.#source = source;
        this.#env.source = source;
      },
      setCurrentSpeed: (speed) => () => {
        this.#currentSpeed = speed;
        this.#env.currentSpeed = speed;
      },
    };
  }

  load = (source: MediaSource): IO.IO<void> => load(source)(this.#env);
  release = (): IO.IO<void> => release(this.#env);
  setupListeners = (): IO.IO<void> => setupVideoEventListeners(this.#env);

  play = (speed = 1): IO.IO<void> => play(speed)(this.#env);
  pause = (): IO.IO<void> => htmlVideoPause(this.#env);
  stop = (): IO.IO<void> => htmlVideoStop(this.#env);
  seek = (position: number): IO.IO<void> => htmlVideoSeek(position)(this.#env);

  setVolume = (volume: number): IO.IO<void> => setVolume(volume)(this.#env);
  setMuted = (muted: boolean): IO.IO<void> => setMuted(muted)(this.#env);
  setFullscreen = (fullscreen: boolean): IO.IO<void> => htmlVideoSetFullscreen(fullscreen)(this.#env);
  setSize = (width: number, height: number): IO.IO<void> => setSize(width, height)(this.#env);

  on = <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void> =>
    on(type, listener)(this.#env);

  off = <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void> =>
    off(type, listener)(this.#env);
}

export const htmlVideoPause: RIO.ReaderIO<HtmlVideoPlayerEnv, void> = pause(LOGGER_NAME);
export const htmlVideoStop: RIO.ReaderIO<HtmlVideoPlayerEnv, void> = stop(LOGGER_NAME);
export const htmlVideoSeek = (position: number): RIO.ReaderIO<HtmlVideoPlayerEnv, void> => seek(position, LOGGER_NAME);
export const htmlVideoSetFullscreen = (fullscreen: boolean): RIO.ReaderIO<HtmlVideoPlayerEnv, void> =>
  setFullscreen(fullscreen, LOGGER_NAME);
export const htmlVideoSetVolume = setVolume;
export const htmlVideoSetMuted = setMuted;
export const htmlVideoSetSize = setSize;
export const htmlVideoOn = on;
export const htmlVideoOff = off;

// Getters

export const getState = (state: HtmlVideoPlayerState): StreamPlayState => state.state;
export const getSource = (state: HtmlVideoPlayerState): MediaSource | null => state.source;
export const getCurrentTime = (state: HtmlVideoPlayerState): number => getCurrentTimeMs(state.videoElement);
export const getDuration = (state: HtmlVideoPlayerState): number => getDurationMs(state.videoElement);
export const getSpeed = (state: HtmlVideoPlayerState): number => state.currentSpeed;
export const getVolume = (state: HtmlVideoPlayerState): number => normalizedToVolume(state.videoElement.volume);
export const getMuted = (state: HtmlVideoPlayerState): boolean => state.videoElement.muted;
export const getFullscreen = (state: HtmlVideoPlayerState): boolean => isFullscreen(state.videoElement);
export const getElement = (state: HtmlVideoPlayerState): HTMLVideoElement => state.videoElement;
