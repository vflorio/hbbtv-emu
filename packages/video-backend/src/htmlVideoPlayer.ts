/**
 * HTML Video Player
 *
 * Base player implementation using HTMLVideoElement.
 * Extended by DASH and HLS players for adaptive streaming.
 */

import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { MediaSource, Player, PlayerError, PlayerEvent, PlayerEventListener, PlayerEventType } from "./types";
import { UnifiedPlayState } from "./types";

const logger = createLogger("HtmlVideoPlayer");

/**
 * Event listener storage.
 */
type EventListeners = {
  [K in PlayerEventType]: Set<PlayerEventListener<K>>;
};

/**
 * Create a new HTML video player.
 */
export const createHtmlVideoPlayer = (): Player => {
  // ─── Private State ─────────────────────────────────────────────────────────
  const videoElement = document.createElement("video");
  let state: UnifiedPlayState = UnifiedPlayState.IDLE;
  let source: MediaSource | null = null;
  let currentSpeed = 1;

  const listeners: EventListeners = {
    statechange: new Set(),
    timeupdate: new Set(),
    durationchange: new Set(),
    volumechange: new Set(),
    error: new Set(),
    ended: new Set(),
    fullscreenchange: new Set(),
  };

  // ─── Event Emission ────────────────────────────────────────────────────────
  const emit = <T extends PlayerEventType>(type: T, data: Omit<PlayerEvent<T>, "type" | "timestamp">): void => {
    const event = { type, timestamp: Date.now(), ...data } as PlayerEvent<T>;
    for (const listener of listeners[type]) {
      try {
        (listener as PlayerEventListener<T>)(event);
      } catch (err) {
        logger.error("Event listener error:", err)();
      }
    }
  };

  const setState = (newState: UnifiedPlayState): void => {
    if (state !== newState) {
      const previousState = state;
      state = newState;
      logger.debug("State changed:", previousState, "->", newState)();
      emit("statechange", { state: newState, previousState });
    }
  };

  // ─── Video Element Event Handlers ──────────────────────────────────────────
  const setupVideoEventListeners = (): IO.IO<void> => () => {
    videoElement.addEventListener("loadstart", () => {
      if (state === UnifiedPlayState.IDLE) {
        setState(UnifiedPlayState.CONNECTING);
      }
    });

    videoElement.addEventListener("canplay", () => {
      if (state === UnifiedPlayState.CONNECTING || state === UnifiedPlayState.BUFFERING) {
        // Don't auto-transition to PLAYING, wait for play() call
      }
    });

    videoElement.addEventListener("playing", () => {
      setState(UnifiedPlayState.PLAYING);
    });

    videoElement.addEventListener("pause", () => {
      if (state === UnifiedPlayState.PLAYING) {
        setState(UnifiedPlayState.PAUSED);
      }
    });

    videoElement.addEventListener("waiting", () => {
      if (state === UnifiedPlayState.PLAYING) {
        setState(UnifiedPlayState.BUFFERING);
      }
    });

    videoElement.addEventListener("ended", () => {
      setState(UnifiedPlayState.FINISHED);
      emit("ended", {});
    });

    videoElement.addEventListener("error", () => {
      const error: PlayerError = {
        code: videoElement.error?.code ?? 0,
        message: videoElement.error?.message ?? "Unknown error",
      };
      setState(UnifiedPlayState.ERROR);
      emit("error", { error });
    });

    videoElement.addEventListener("timeupdate", () => {
      emit("timeupdate", { currentTime: Math.floor(videoElement.currentTime * 1000) });
    });

    videoElement.addEventListener("durationchange", () => {
      if (Number.isFinite(videoElement.duration)) {
        emit("durationchange", { duration: Math.floor(videoElement.duration * 1000) });
      }
    });

    videoElement.addEventListener("volumechange", () => {
      emit("volumechange", {
        volume: Math.round(videoElement.volume * 100),
        muted: videoElement.muted,
      });
    });

    document.addEventListener("fullscreenchange", () => {
      emit("fullscreenchange", {
        fullscreen: document.fullscreenElement === videoElement,
      });
    });
  };

  // Initialize event listeners
  setupVideoEventListeners()();

  // ─── Player Implementation ─────────────────────────────────────────────────
  const player: Player = {
    get state() {
      return state;
    },
    get source() {
      return source;
    },
    get currentTime() {
      return Math.floor(videoElement.currentTime * 1000);
    },
    get duration() {
      return Number.isFinite(videoElement.duration) ? Math.floor(videoElement.duration * 1000) : 0;
    },
    get speed() {
      return currentSpeed;
    },
    get volume() {
      return Math.round(videoElement.volume * 100);
    },
    get muted() {
      return videoElement.muted;
    },
    get fullscreen() {
      return document.fullscreenElement === videoElement;
    },

    load: (newSource: MediaSource): void => {
      pipe(
        logger.debug("Loading source:", newSource.url),
        IO.tap(() =>
          IO.of(() => {
            source = newSource;
            videoElement.src = newSource.url;
            videoElement.load();
            setState(UnifiedPlayState.CONNECTING);
          }),
        ),
      )();
    },

    play: (speed = 1): void => {
      pipe(
        logger.debug("Play:", speed),
        IO.tap(() =>
          IO.of(() => {
            currentSpeed = speed;
            videoElement.playbackRate = Math.abs(speed);

            if (speed === 0) {
              videoElement.pause();
            } else {
              videoElement.play().catch((err) => {
                logger.error("Play failed:", err)();
                const error: PlayerError = { code: 0, message: String(err) };
                setState(UnifiedPlayState.ERROR);
                emit("error", { error });
              });
            }
          }),
        ),
      )();
    },

    pause: (): void => {
      pipe(
        logger.debug("Pause"),
        IO.tap(() => IO.of(() => videoElement.pause())),
      )();
    },

    stop: (): void => {
      pipe(
        logger.debug("Stop"),
        IO.tap(() =>
          IO.of(() => {
            videoElement.pause();
            videoElement.currentTime = 0;
            setState(UnifiedPlayState.STOPPED);
          }),
        ),
      )();
    },

    seek: (position: number): void => {
      pipe(
        logger.debug("Seek:", position),
        IO.tap(() =>
          IO.of(() => {
            const posSeconds = position / 1000;
            if (posSeconds >= 0 && posSeconds <= videoElement.duration) {
              videoElement.currentTime = posSeconds;
            }
          }),
        ),
      )();
    },

    release: (): void => {
      pipe(
        logger.debug("Release"),
        IO.tap(() =>
          IO.of(() => {
            videoElement.pause();
            videoElement.removeAttribute("src");
            videoElement.load();
            source = null;
            setState(UnifiedPlayState.IDLE);
          }),
        ),
      )();
    },

    setVolume: (volume: number): void => {
      const clamped = Math.max(0, Math.min(100, volume));
      videoElement.volume = clamped / 100;
    },

    setMuted: (muted: boolean): void => {
      videoElement.muted = muted;
    },

    setFullscreen: (fullscreen: boolean): void => {
      if (fullscreen && !document.fullscreenElement) {
        videoElement.requestFullscreen?.().catch((err) => {
          logger.warn("Fullscreen request failed:", err)();
        });
      } else if (!fullscreen && document.fullscreenElement === videoElement) {
        document.exitFullscreen?.().catch((err) => {
          logger.warn("Exit fullscreen failed:", err)();
        });
      }
    },

    setSize: (width: number, height: number): void => {
      videoElement.style.width = `${width}px`;
      videoElement.style.height = `${height}px`;
    },

    on: <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): void => {
      listeners[type].add(listener as PlayerEventListener<PlayerEventType>);
    },

    off: <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): void => {
      listeners[type].delete(listener as PlayerEventListener<PlayerEventType>);
    },

    getVideoElement: (): HTMLVideoElement => videoElement,
  };

  return player;
};
