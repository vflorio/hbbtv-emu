// DASH.js Player - MPEG-DASH adaptive streaming implementation

import { createLogger } from "@hbb-emu/core";
import * as dashjs from "dashjs";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as RIO from "fp-ts/ReaderIO";
import { match } from "ts-pattern";
import type { PlayerEventListener, PlayerEventType, VideoStreamSource } from "../types";
import { VideoStreamPlayState } from "../types";
import type { Player } from ".";
import {
  createDashError,
  createEventListeners,
  type EventListeners,
  emit,
  getCurrentTimeMs,
  getDurationMs,
  isFullscreen,
  msToSeconds,
  normalizedToVolume,
  off,
  on,
  type PlayerEnv,
  playBase,
  setFullscreen,
  setSize,
  setState,
  setVolume,
} from "./common";

const LOGGER_NAME = "DashPlayer";
const logger = createLogger(LOGGER_NAME);

// State

export type DashPlayerState = {
  state: VideoStreamPlayState;
  source: VideoStreamSource | null;
  currentSpeed: number;
  videoElement: HTMLVideoElement;
  listeners: EventListeners;
  dashPlayer: dashjs.MediaPlayerClass | null;
};

export const createDashPlayerState = (): DashPlayerState => ({
  state: VideoStreamPlayState.IDLE,
  source: null,
  currentSpeed: 1,
  videoElement: document.createElement("video"),
  listeners: createEventListeners(),
  dashPlayer: null,
});

// Environment

export type DashPlayerEnv = PlayerEnv & {
  dashPlayer: dashjs.MediaPlayerClass | null;
  setDashPlayer: (player: dashjs.MediaPlayerClass | null) => IO.IO<void>;
};

export const createDashPlayerEnv = (state: DashPlayerState): DashPlayerEnv => ({
  state: state.state,
  source: state.source,
  currentSpeed: state.currentSpeed,
  listeners: state.listeners,
  videoElement: state.videoElement,
  dashPlayer: state.dashPlayer,
  setState: (newState: VideoStreamPlayState) => () => {
    state.state = newState;
  },
  setSource: (source: VideoStreamSource | null) => () => {
    state.source = source;
  },
  setCurrentSpeed: (speed: number) => () => {
    state.currentSpeed = speed;
  },
  setDashPlayer: (player: dashjs.MediaPlayerClass | null) => () => {
    state.dashPlayer = player;
  },
});

// Methods

const initDashPlayer: RIO.ReaderIO<DashPlayerEnv, dashjs.MediaPlayerClass> = pipe(
  RIO.ask<DashPlayerEnv>(),
  RIO.flatMap((env) =>
    match(env.dashPlayer)
      .with(null, () =>
        pipe(
          RIO.of<DashPlayerEnv, dashjs.MediaPlayerClass>(dashjs.MediaPlayer().create()),
          RIO.tapIO((player) => () => {
            player.initialize(env.videoElement, undefined, false);
          }),
          RIO.tap((player) => setupDashEventHandlers(player)),
          RIO.tapIO((player) => env.setDashPlayer(player)),
        ),
      )
      .otherwise((player) => RIO.of(player)),
  ),
);

const setupDashEventHandlers = (dashPlayer: dashjs.MediaPlayerClass): RIO.ReaderIO<DashPlayerEnv, void> =>
  pipe(
    RIO.ask<DashPlayerEnv>(),
    RIO.flatMapIO((env) => () => {
      dashPlayer.on("error", (event: unknown) => {
        pipe(
          setState(VideoStreamPlayState.ERROR, LOGGER_NAME),
          RIO.flatMap(() => emit("error", { error: createDashError(event) }, LOGGER_NAME)),
        )(env)();
      });

      dashPlayer.on("playbackStarted", () => {
        setState(VideoStreamPlayState.PLAYING, LOGGER_NAME)(env)();
      });

      dashPlayer.on("playbackPaused", () => {
        match(env.state)
          .with(VideoStreamPlayState.PLAYING, () => setState(VideoStreamPlayState.PAUSED, LOGGER_NAME)(env)())
          .otherwise(() => {});
      });

      dashPlayer.on("bufferStalled", () => {
        match(env.state)
          .with(VideoStreamPlayState.PLAYING, () => setState(VideoStreamPlayState.BUFFERING, LOGGER_NAME)(env)())
          .otherwise(() => {});
      });

      dashPlayer.on("bufferLoaded", () => {
        match(env.state)
          .with(VideoStreamPlayState.BUFFERING, () => setState(VideoStreamPlayState.PLAYING, LOGGER_NAME)(env)())
          .otherwise(() => {});
      });

      dashPlayer.on("playbackEnded", () => {
        pipe(
          setState(VideoStreamPlayState.FINISHED, LOGGER_NAME),
          RIO.flatMap(() => emit("ended", {}, LOGGER_NAME)),
        )(env)();
      });
    }),
  );

export const setupVideoEventListeners: RIO.ReaderIO<DashPlayerEnv, void> = pipe(
  RIO.ask<DashPlayerEnv>(),
  RIO.flatMapIO((env) => () => {
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

export const load = (source: VideoStreamSource): RIO.ReaderIO<DashPlayerEnv, void> =>
  pipe(
    RIO.ask<DashPlayerEnv>(),
    RIO.tapIO(() => logger.debug("Loading DASH source:", source.url)),
    RIO.tapIO((env) => env.setSource(source)),
    RIO.tapIO((env) => setState(VideoStreamPlayState.CONNECTING, LOGGER_NAME)(env)),
    RIO.flatMap(() => initDashPlayer),
    RIO.flatMap((dashPlayer) =>
      pipe(
        RIO.ask<DashPlayerEnv>(),
        RIO.flatMapIO((env) => () => {
          if (env.source?.drm) {
            dashPlayer.setProtectionData({
              [env.source.drm.system]: {
                serverURL: env.source.drm.licenseUrl,
                httpRequestHeaders: env.source.drm.headers,
              },
            });
          }
          dashPlayer.attachSource(source.url);
        }),
      ),
    ),
  );

export const play = (speed: number): RIO.ReaderIO<DashPlayerEnv, void> =>
  pipe(
    playBase(speed, LOGGER_NAME),
    RIO.flatMap(() =>
      pipe(
        RIO.ask<DashPlayerEnv>(),
        RIO.flatMapIO((env) => () => {
          match(speed)
            .with(0, () => env.videoElement.pause())
            .otherwise(() => env.dashPlayer?.play());
        }),
      ),
    ),
  );

export const pause: RIO.ReaderIO<DashPlayerEnv, void> = pipe(
  RIO.ask<DashPlayerEnv>(),
  RIO.tapIO(() => logger.debug("Pause")),
  RIO.flatMapIO((env) => () => env.dashPlayer?.pause()),
);

export const stop: RIO.ReaderIO<DashPlayerEnv, void> = pipe(
  RIO.ask<DashPlayerEnv>(),
  RIO.tapIO(() => logger.debug("Stop")),
  RIO.tapIO((env) => () => {
    env.dashPlayer?.pause();
    env.videoElement.currentTime = 0;
  }),
  RIO.tapIO((env) => setState(VideoStreamPlayState.STOPPED, LOGGER_NAME)(env)),
  RIO.map(() => undefined),
);

export const seek = (position: number): RIO.ReaderIO<DashPlayerEnv, void> =>
  pipe(
    RIO.ask<DashPlayerEnv>(),
    RIO.tapIO(() => logger.debug("Seek:", position)),
    RIO.flatMapIO((env) => () => env.dashPlayer?.seek(msToSeconds(position))),
  );

export const release: RIO.ReaderIO<DashPlayerEnv, void> = pipe(
  RIO.ask<DashPlayerEnv>(),
  RIO.tapIO(() => logger.debug("Release")),
  RIO.tapIO((env) => () => {
    env.dashPlayer?.reset();
  }),
  RIO.tapIO((env) => env.setDashPlayer(null)),
  RIO.tapIO((env) => env.setSource(null)),
  RIO.tapIO((env) => setState(VideoStreamPlayState.IDLE, LOGGER_NAME)(env)),
  RIO.map(() => undefined),
);

export const setMuted = (muted: boolean): RIO.ReaderIO<DashPlayerEnv, void> =>
  pipe(
    RIO.ask<DashPlayerEnv>(),
    RIO.flatMapIO((env) => () => env.dashPlayer?.setMute(muted)),
  );

// DashPlayer Class

export class DashPlayer implements Player {
  readonly sourceType = "dash" as const;
  readonly videoElement: HTMLVideoElement;

  readonly #env: DashPlayerEnv;
  #state: VideoStreamPlayState = VideoStreamPlayState.IDLE;
  #source: VideoStreamSource | null = null;
  #currentSpeed = 1;
  #dashPlayer: dashjs.MediaPlayerClass | null = null;

  constructor() {
    this.videoElement = document.createElement("video");

    this.#env = {
      state: this.#state,
      source: this.#source,
      currentSpeed: this.#currentSpeed,
      listeners: createEventListeners(),
      videoElement: this.videoElement,
      dashPlayer: this.#dashPlayer,
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
      setDashPlayer: (player) => () => {
        this.#dashPlayer = player;
        this.#env.dashPlayer = player;
      },
    };
  }

  load = (source: VideoStreamSource): IO.IO<void> => load(source)(this.#env);
  release = (): IO.IO<void> => release(this.#env);
  setupListeners = (): IO.IO<void> => setupVideoEventListeners(this.#env);

  play = (speed = 1): IO.IO<void> => play(speed)(this.#env);
  pause = (): IO.IO<void> => pause(this.#env);
  stop = (): IO.IO<void> => stop(this.#env);
  seek = (position: number): IO.IO<void> => seek(position)(this.#env);

  setVolume = (volume: number): IO.IO<void> => setVolume(volume)(this.#env);
  setMuted = (muted: boolean): IO.IO<void> => setMuted(muted)(this.#env);
  setFullscreen = (fullscreen: boolean): IO.IO<void> => dashSetFullscreen(fullscreen)(this.#env);
  setSize = (width: number, height: number): IO.IO<void> => setSize(width, height)(this.#env);

  on = <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void> =>
    on(type, listener)(this.#env);

  off = <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void> =>
    off(type, listener)(this.#env);
}

// Wrappers

export const dashSetFullscreen = (fullscreen: boolean): RIO.ReaderIO<DashPlayerEnv, void> =>
  setFullscreen(fullscreen, LOGGER_NAME);
export const dashSetVolume = setVolume;
export const dashSetSize = setSize;
export const dashOn = on;
export const dashOff = off;

// Getters

export const getState = (state: DashPlayerState): VideoStreamPlayState => state.state;
export const getSource = (state: DashPlayerState): VideoStreamSource | null => state.source;
export const getCurrentTime = (state: DashPlayerState): number => getCurrentTimeMs(state.videoElement);
export const getDuration = (state: DashPlayerState): number => getDurationMs(state.videoElement);
export const getSpeed = (state: DashPlayerState): number => state.currentSpeed;
export const getVolume = (state: DashPlayerState): number => normalizedToVolume(state.videoElement.volume);
export const getMuted = (state: DashPlayerState): boolean => state.videoElement.muted;
export const getFullscreen = (state: DashPlayerState): boolean => isFullscreen(state.videoElement);
export const getElement = (state: DashPlayerState): HTMLVideoElement => state.videoElement;
