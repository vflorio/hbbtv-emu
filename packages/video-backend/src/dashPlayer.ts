/**
 * DASH.js Player
 *
 * Player implementation using DASH.js for MPEG-DASH adaptive streaming.
 */

import { createLogger } from "@hbb-emu/core";
import type dashjs from "dashjs";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { MediaSource, Player, PlayerError, PlayerEvent, PlayerEventListener, PlayerEventType } from "./types";
import { UnifiedPlayState } from "./types";

/** DASH.js MediaPlayer instance type */
type DashMediaPlayer = ReturnType<typeof dashjs.MediaPlayer>;
type DashMediaPlayerInstance = ReturnType<DashMediaPlayer["create"]>;

const logger = createLogger("DashPlayer");

/**
 * Event listener storage.
 */
type EventListeners = {
  [K in PlayerEventType]: Set<PlayerEventListener<K>>;
};

/**
 * Create a new DASH.js player.
 */
export const createDashPlayer = (): Player => {
  // ─── Private State ─────────────────────────────────────────────────────────
  const videoElement = document.createElement("video");
  let dashPlayer: DashMediaPlayerInstance | null = null;
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

  // ─── DASH.js Initialization ────────────────────────────────────────────────
  const initDashPlayer = async (): Promise<DashMediaPlayerInstance> => {
    if (dashPlayer) {
      return dashPlayer;
    }

    // Dynamic import to avoid loading dashjs if not needed
    const dashjs = await import("dashjs");
    dashPlayer = dashjs.MediaPlayer().create();
    dashPlayer.initialize(videoElement, undefined, false);

    // Set up DASH.js event handlers
    dashPlayer.on("error", (event: unknown) => {
      const error: PlayerError = {
        code: 0,
        message: "DASH playback error",
        details: event,
      };
      setState(UnifiedPlayState.ERROR);
      emit("error", { error });
    });

    dashPlayer.on("playbackStarted", () => {
      setState(UnifiedPlayState.PLAYING);
    });

    dashPlayer.on("playbackPaused", () => {
      if (state === UnifiedPlayState.PLAYING) {
        setState(UnifiedPlayState.PAUSED);
      }
    });

    dashPlayer.on("bufferStalled", () => {
      if (state === UnifiedPlayState.PLAYING) {
        setState(UnifiedPlayState.BUFFERING);
      }
    });

    dashPlayer.on("bufferLoaded", () => {
      if (state === UnifiedPlayState.BUFFERING) {
        setState(UnifiedPlayState.PLAYING);
      }
    });

    dashPlayer.on("playbackEnded", () => {
      setState(UnifiedPlayState.FINISHED);
      emit("ended", {});
    });

    return dashPlayer;
  };

  // ─── Video Element Event Handlers ──────────────────────────────────────────
  const setupVideoEventListeners = (): IO.IO<void> => () => {
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
        logger.debug("Loading DASH source:", newSource.url),
        IO.tap(() =>
          IO.of(() => {
            source = newSource;
            setState(UnifiedPlayState.CONNECTING);

            initDashPlayer().then((dp) => {
              // Configure DRM if provided
              if (newSource.drm) {
                dp.setProtectionData({
                  [newSource.drm.system]: {
                    serverURL: newSource.drm.licenseUrl,
                    httpRequestHeaders: newSource.drm.headers,
                  },
                });
              }

              dp.attachSource(newSource.url);
            });
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
              dashPlayer?.play();
            }
          }),
        ),
      )();
    },

    pause: (): void => {
      pipe(
        logger.debug("Pause"),
        IO.tap(() => IO.of(() => dashPlayer?.pause())),
      )();
    },

    stop: (): void => {
      pipe(
        logger.debug("Stop"),
        IO.tap(() =>
          IO.of(() => {
            dashPlayer?.pause();
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
            dashPlayer?.seek(position / 1000);
          }),
        ),
      )();
    },

    release: (): void => {
      pipe(
        logger.debug("Release"),
        IO.tap(() =>
          IO.of(() => {
            dashPlayer?.reset();
            dashPlayer = null;
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
      dashPlayer?.setMute(muted);
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
