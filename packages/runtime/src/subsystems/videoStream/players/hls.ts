// HLS.js Player - HLS adaptive streaming implementation

import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as RIO from "fp-ts/ReaderIO";
import type Hls from "hls.js";
import { match } from "ts-pattern";
import type { Player } from "../..";
import type { PlayerEventListener, PlayerEventType, VideoStreamSource } from "../types";
import { VideoStreamPlayState } from "../types";
import {
  createEventListeners,
  createHlsError,
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
  setMuted as setMutedBase,
  setSize,
  setState,
  setVolume,
} from "./common";

const LOGGER_NAME = "HlsPlayer";
const logger = createLogger(LOGGER_NAME);

// State

export type HlsPlayerState = {
  state: VideoStreamPlayState;
  source: VideoStreamSource | null;
  currentSpeed: number;
  videoElement: HTMLVideoElement;
  listeners: EventListeners;
  hlsPlayer: Hls | null;
};

export const createHlsPlayerState = (): HlsPlayerState => ({
  state: VideoStreamPlayState.IDLE,
  source: null,
  currentSpeed: 1,
  videoElement: document.createElement("video"),
  listeners: createEventListeners(),
  hlsPlayer: null,
});

// Environment

export type HlsPlayerEnv = PlayerEnv & {
  hlsPlayer: Hls | null;
  setHlsPlayer: (player: Hls | null) => IO.IO<void>;
};

export const createHlsPlayerEnv = (state: HlsPlayerState): HlsPlayerEnv => ({
  state: state.state,
  source: state.source,
  currentSpeed: state.currentSpeed,
  listeners: state.listeners,
  videoElement: state.videoElement,
  hlsPlayer: state.hlsPlayer,
  setState: (newState: VideoStreamPlayState) => () => {
    state.state = newState;
  },
  setSource: (source: VideoStreamSource | null) => () => {
    state.source = source;
  },
  setCurrentSpeed: (speed: number) => () => {
    state.currentSpeed = speed;
  },
  setHlsPlayer: (player: Hls | null) => () => {
    state.hlsPlayer = player;
  },
});

// Methods

const initHlsPlayer = async (env: HlsPlayerEnv): Promise<Hls> => {
  if (env.hlsPlayer) {
    return env.hlsPlayer;
  }

  const HlsModule = await import("hls.js");
  const HlsClass = HlsModule.default;

  if (!HlsClass.isSupported()) {
    throw new Error("HLS.js is not supported in this browser");
  }

  const hls = new HlsClass({
    enableWorker: true,
    lowLatencyMode: false,
  });

  hls.attachMedia(env.videoElement);
  setupHlsEventHandlers(hls, HlsClass, env);
  env.setHlsPlayer(hls)();

  return hls;
};

const setupHlsEventHandlers = (hls: Hls, HlsClass: typeof import("hls.js").default, env: HlsPlayerEnv): void => {
  hls.on(HlsClass.Events.ERROR, (_event, data) => {
    if (data.fatal) {
      pipe(
        setState(VideoStreamPlayState.ERROR, LOGGER_NAME),
        RIO.flatMap(() => emit("error", { error: createHlsError(data) }, LOGGER_NAME)),
      )(env)();
    }
  });

  hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
    logger.debug("HLS manifest parsed")();
  });

  hls.on(HlsClass.Events.FRAG_BUFFERED, () => {
    match(env.state)
      .with(VideoStreamPlayState.BUFFERING, () => setState(VideoStreamPlayState.PLAYING, LOGGER_NAME)(env)())
      .otherwise(() => {});
  });
};

export const setupVideoEventListeners: RIO.ReaderIO<HlsPlayerEnv, void> = pipe(
  RIO.ask<HlsPlayerEnv>(),
  RIO.flatMapIO((env) => () => {
    env.videoElement.addEventListener("playing", () => {
      setState(VideoStreamPlayState.PLAYING, LOGGER_NAME)(env)();
    });

    env.videoElement.addEventListener("pause", () => {
      match(env.state)
        .with(VideoStreamPlayState.PLAYING, () => setState(VideoStreamPlayState.PAUSED, LOGGER_NAME)(env)())
        .otherwise(() => {});
    });

    env.videoElement.addEventListener("ended", () => {
      pipe(
        setState(VideoStreamPlayState.FINISHED, LOGGER_NAME),
        RIO.flatMap(() => emit("ended", {}, LOGGER_NAME)),
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

export const load = (source: VideoStreamSource): RIO.ReaderIO<HlsPlayerEnv, void> =>
  pipe(
    RIO.ask<HlsPlayerEnv>(),
    RIO.tapIO(() => logger.debug("Loading HLS source:", source.url)),
    RIO.tapIO((env) => env.setSource(source)),
    RIO.tapIO((env) => setState(VideoStreamPlayState.CONNECTING, LOGGER_NAME)(env)),
    RIO.flatMapIO((env) => () => {
      initHlsPlayer(env)
        .then((hls) => {
          hls.loadSource(source.url);
        })
        .catch((err) => {
          logger.error("HLS init failed:", err)();
          pipe(
            setState(VideoStreamPlayState.ERROR, LOGGER_NAME),
            RIO.flatMap(() => emit("error", { error: { code: 0, message: String(err) } }, LOGGER_NAME)),
          )(env)();
        });
    }),
  );

export const play = (speed: number): RIO.ReaderIO<HlsPlayerEnv, void> =>
  pipe(
    playBase(speed, LOGGER_NAME),
    RIO.flatMap(() =>
      pipe(
        RIO.ask<HlsPlayerEnv>(),
        RIO.flatMapIO((env) => () => {
          match(speed)
            .with(0, () => env.videoElement.pause())
            .otherwise(() => {
              env.videoElement.play().catch((err: unknown) => {
                logger.error("Play failed:", err)();
                pipe(
                  setState(VideoStreamPlayState.ERROR, LOGGER_NAME),
                  RIO.flatMap(() => emit("error", { error: { code: 0, message: String(err) } }, LOGGER_NAME)),
                )(env)();
              });
            });
        }),
      ),
    ),
  );

export const pause: RIO.ReaderIO<HlsPlayerEnv, void> = pipe(
  RIO.ask<HlsPlayerEnv>(),
  RIO.tapIO(() => logger.debug("Pause")),
  RIO.flatMapIO((env) => () => env.videoElement.pause()),
);

export const stop: RIO.ReaderIO<HlsPlayerEnv, void> = pipe(
  RIO.ask<HlsPlayerEnv>(),
  RIO.tapIO(() => logger.debug("Stop")),
  RIO.tapIO((env) => () => {
    env.videoElement.pause();
    env.videoElement.currentTime = 0;
  }),
  RIO.tapIO((env) => setState(VideoStreamPlayState.STOPPED, LOGGER_NAME)(env)),
  RIO.map(() => undefined),
);

export const seek = (position: number): RIO.ReaderIO<HlsPlayerEnv, void> =>
  pipe(
    RIO.ask<HlsPlayerEnv>(),
    RIO.tapIO(() => logger.debug("Seek:", position)),
    RIO.flatMapIO((env) => () => {
      const posSeconds = msToSeconds(position);
      if (posSeconds >= 0 && posSeconds <= env.videoElement.duration) {
        env.videoElement.currentTime = posSeconds;
      }
    }),
  );

export const release: RIO.ReaderIO<HlsPlayerEnv, void> = pipe(
  RIO.ask<HlsPlayerEnv>(),
  RIO.tapIO(() => logger.debug("Release")),
  RIO.tapIO((env) => () => {
    env.hlsPlayer?.destroy();
  }),
  RIO.tapIO((env) => env.setHlsPlayer(null)),
  RIO.tapIO((env) => env.setSource(null)),
  RIO.tapIO((env) => setState(VideoStreamPlayState.IDLE, LOGGER_NAME)(env)),
  RIO.map(() => undefined),
);

export const setMuted = setMutedBase;

// HlsPlayer Class

export class HlsPlayer implements Player {
  readonly sourceType = "hls" as const;
  readonly videoElement: HTMLVideoElement;

  readonly #env: HlsPlayerEnv;
  #state: VideoStreamPlayState = VideoStreamPlayState.IDLE;
  #source: VideoStreamSource | null = null;
  #currentSpeed = 1;
  #hlsPlayer: Hls | null = null;

  constructor() {
    this.videoElement = document.createElement("video");

    this.#env = {
      state: this.#state,
      source: this.#source,
      currentSpeed: this.#currentSpeed,
      listeners: createEventListeners(),
      videoElement: this.videoElement,
      hlsPlayer: this.#hlsPlayer,
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
      setHlsPlayer: (player) => () => {
        this.#hlsPlayer = player;
        this.#env.hlsPlayer = player;
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
  setFullscreen = (fullscreen: boolean): IO.IO<void> => setFullscreen(fullscreen, LOGGER_NAME)(this.#env);
  setSize = (width: number, height: number): IO.IO<void> => setSize(width, height)(this.#env);

  on = <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void> =>
    on(type, listener)(this.#env);

  off = <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void> =>
    off(type, listener)(this.#env);
}

// Wrapper

export const hlsSetFullscreen = (fullscreen: boolean): RIO.ReaderIO<HlsPlayerEnv, void> =>
  setFullscreen(fullscreen, LOGGER_NAME);
export const hlsSetVolume = setVolume;
export const hlsSetSize = setSize;
export const hlsOn = on;
export const hlsOff = off;

// Getters

export const getState = (state: HlsPlayerState): VideoStreamPlayState => state.state;
export const getSource = (state: HlsPlayerState): VideoStreamSource | null => state.source;
export const getCurrentTime = (state: HlsPlayerState): number => getCurrentTimeMs(state.videoElement);
export const getDuration = (state: HlsPlayerState): number => getDurationMs(state.videoElement);
export const getSpeed = (state: HlsPlayerState): number => state.currentSpeed;
export const getVolume = (state: HlsPlayerState): number => normalizedToVolume(state.videoElement.volume);
export const getMuted = (state: HlsPlayerState): boolean => state.videoElement.muted;
export const getFullscreen = (state: HlsPlayerState): boolean => isFullscreen(state.videoElement);
export const getElement = (state: HlsPlayerState): HTMLVideoElement => state.videoElement;
