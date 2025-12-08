/**
 * DASH.js Player
 *
 * Player implementation using DASH.js for MPEG-DASH adaptive streaming.
 */

import { createLogger } from "@hbb-emu/core";
import * as dashjs from "dashjs";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { MediaSource, Player, PlayerError, PlayerEvent, PlayerEventListener, PlayerEventType } from "../types";
import { UnifiedPlayState } from "../types";

const logger = createLogger("DashPlayer");

/**
 * DASH.js Player implementation.
 * Manages DASH.js lifecycle, event handling, and playback control.
 */
export class DashPlayer implements Player {
  readonly #videoElement: HTMLVideoElement;
  readonly #listeners: EventListeners;
  #dashPlayer: dashjs.MediaPlayerClass | null = null;
  #state: UnifiedPlayState = UnifiedPlayState.IDLE;
  #source: MediaSource | null = null;
  #currentSpeed = 1;

  constructor() {
    this.#videoElement = document.createElement("video");
    this.#listeners = createEventListeners();
    this.#setupVideoEventListeners()();
  }

  readonly #initDashPlayer = (): IO.IO<dashjs.MediaPlayerClass> => () => {
    if (this.#dashPlayer) {
      return this.#dashPlayer;
    }

    this.#dashPlayer = dashjs.MediaPlayer().create();
    this.#dashPlayer.initialize(this.#videoElement, undefined, false);

    this.#setupDashEventHandlers(this.#dashPlayer);

    return this.#dashPlayer;
  };

  readonly #setupDashEventHandlers = (dashPlayer: dashjs.MediaPlayerClass): void => {
    dashPlayer.on("error", (event: unknown) => {
      pipe(
        this.#setState(UnifiedPlayState.ERROR),
        IO.flatMap(() => this.#emit("error", { error: createDashError(event) })),
      )();
    });

    dashPlayer.on("playbackStarted", () => {
      this.#setState(UnifiedPlayState.PLAYING)();
    });

    dashPlayer.on("playbackPaused", () => {
      if (this.#state === UnifiedPlayState.PLAYING) {
        this.#setState(UnifiedPlayState.PAUSED)();
      }
    });

    dashPlayer.on("bufferStalled", () => {
      if (this.#state === UnifiedPlayState.PLAYING) {
        this.#setState(UnifiedPlayState.BUFFERING)();
      }
    });

    dashPlayer.on("bufferLoaded", () => {
      if (this.#state === UnifiedPlayState.BUFFERING) {
        this.#setState(UnifiedPlayState.PLAYING)();
      }
    });

    dashPlayer.on("playbackEnded", () => {
      pipe(
        this.#setState(UnifiedPlayState.FINISHED),
        IO.flatMap(() => this.#emit("ended", {})),
      )();
    });
  };

  readonly #setupVideoEventListeners = (): IO.IO<void> =>
    IO.of(() => {
      this.#videoElement.addEventListener("timeupdate", () => {
        this.#emit("timeupdate", { currentTime: getCurrentTimeMs(this.#videoElement) })();
      });

      this.#videoElement.addEventListener("durationchange", () => {
        if (Number.isFinite(this.#videoElement.duration)) {
          this.#emit("durationchange", { duration: getDurationMs(this.#videoElement) })();
        }
      });

      this.#videoElement.addEventListener("volumechange", () => {
        this.#emit("volumechange", {
          volume: normalizedToVolume(this.#videoElement.volume),
          muted: this.#videoElement.muted,
        })();
      });

      document.addEventListener("fullscreenchange", () => {
        this.#emit("fullscreenchange", { fullscreen: isFullscreen(this.#videoElement) })();
      });
    });

  readonly #emit = <T extends PlayerEventType>(
    type: T,
    data: Omit<PlayerEvent<T>, "type" | "timestamp">,
  ): IO.IO<void> =>
    pipe(
      IO.of(createPlayerEvent(type, data)),
      IO.flatMap((event) =>
        IO.of(() => {
          for (const listener of this.#listeners[type]) {
            try {
              (listener as PlayerEventListener<T>)(event);
            } catch (err) {
              logger.error("Event listener error:", err)();
            }
          }
        }),
      ),
    );

  readonly #setState =
    (newState: UnifiedPlayState): IO.IO<void> =>
    () => {
      if (this.#state === newState) return;
      const previousState = this.#state;
      this.#state = newState;
      pipe(
        logger.debug("State changed:", previousState, "->", newState),
        IO.flatMap(() => this.#emit("statechange", { state: newState, previousState })),
      )();
    };

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  get state(): UnifiedPlayState {
    return this.#state;
  }

  get source(): MediaSource | null {
    return this.#source;
  }

  get currentTime(): number {
    return getCurrentTimeMs(this.#videoElement);
  }

  get duration(): number {
    return getDurationMs(this.#videoElement);
  }

  get speed(): number {
    return this.#currentSpeed;
  }

  get volume(): number {
    return normalizedToVolume(this.#videoElement.volume);
  }

  get muted(): boolean {
    return this.#videoElement.muted;
  }

  get fullscreen(): boolean {
    return isFullscreen(this.#videoElement);
  }

  getElement = (): HTMLVideoElement => this.#videoElement;

  // Playback Control

  load = (newSource: MediaSource): void => {
    pipe(
      logger.debug("Loading DASH source:", newSource.url),
      IO.flatMap(() =>
        IO.of(() => {
          this.#source = newSource;
        }),
      ),
      IO.flatMap(() => this.#setState(UnifiedPlayState.CONNECTING)),
      IO.flatMap(() => this.#initDashPlayer()),
      IO.flatMap((dashPlayer) =>
        IO.of(() => {
          if (newSource.drm) {
            dashPlayer.setProtectionData({
              [newSource.drm.system]: {
                serverURL: newSource.drm.licenseUrl,
                httpRequestHeaders: newSource.drm.headers,
              },
            });
          }
          dashPlayer.attachSource(newSource.url);
        }),
      ),
    )();
  };

  play = (speed = 1): void => {
    pipe(
      logger.debug("Play:", speed),
      IO.flatMap(() =>
        IO.of(() => {
          this.#currentSpeed = speed;
          this.#videoElement.playbackRate = Math.abs(speed);

          if (speed === 0) {
            this.#videoElement.pause();
          } else {
            this.#dashPlayer?.play();
          }
        }),
      ),
    )();
  };

  pause = (): void => {
    pipe(
      logger.debug("Pause"),
      IO.flatMap(() => IO.of(() => this.#dashPlayer?.pause())),
    )();
  };

  stop = (): void => {
    pipe(
      logger.debug("Stop"),
      IO.flatMap(() =>
        IO.of(() => {
          this.#dashPlayer?.pause();
          this.#videoElement.currentTime = 0;
        }),
      ),
      IO.flatMap(() => this.#setState(UnifiedPlayState.STOPPED)),
    )();
  };

  seek = (position: number): void => {
    pipe(
      logger.debug("Seek:", position),
      IO.flatMap(() => IO.of(() => this.#dashPlayer?.seek(msToSeconds(position)))),
    )();
  };

  release = (): void => {
    pipe(
      logger.debug("Release"),
      IO.flatMap(() =>
        IO.of(() => {
          this.#dashPlayer?.reset();
          this.#dashPlayer = null;
          this.#source = null;
        }),
      ),
      IO.flatMap(() => this.#setState(UnifiedPlayState.IDLE)),
    )();
  };

  // Audio Control

  setVolume = (volume: number): void => {
    this.#videoElement.volume = volumeToNormalized(volume);
  };

  setMuted = (muted: boolean): void => {
    this.#dashPlayer?.setMute(muted);
  };

  // Display Control

  setFullscreen = (fullscreen: boolean): void => {
    if (fullscreen && !document.fullscreenElement) {
      this.#videoElement.requestFullscreen?.().catch((err) => {
        logger.warn("Fullscreen request failed:", err)();
      });
    } else if (!fullscreen && document.fullscreenElement === this.#videoElement) {
      document.exitFullscreen?.().catch((err) => {
        logger.warn("Exit fullscreen failed:", err)();
      });
    }
  };

  setSize = (width: number, height: number): void => {
    this.#videoElement.style.width = `${width}px`;
    this.#videoElement.style.height = `${height}px`;
  };

  // Event Subscription

  on = <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): void => {
    this.#listeners[type].add(listener as PlayerEventListener<PlayerEventType>);
  };

  off = <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): void => {
    this.#listeners[type].delete(listener as PlayerEventListener<PlayerEventType>);
  };
}

type EventListeners = {
  [K in PlayerEventType]: Set<PlayerEventListener<K>>;
};

const createEventListeners = (): EventListeners => ({
  statechange: new Set(),
  timeupdate: new Set(),
  durationchange: new Set(),
  volumechange: new Set(),
  error: new Set(),
  ended: new Set(),
  fullscreenchange: new Set(),
});

const createPlayerEvent = <T extends PlayerEventType>(
  type: T,
  data: Omit<PlayerEvent<T>, "type" | "timestamp">,
): PlayerEvent<T> => ({ type, timestamp: Date.now(), ...data }) as PlayerEvent<T>;

const createDashError = (event: unknown): PlayerError => ({
  code: 0,
  message: "DASH playback error",
  details: event,
});

const msToSeconds = (ms: number): number => ms / 1000;

const secondsToMs = (seconds: number): number => Math.floor(seconds * 1000);

const clampVolume = (volume: number): number => Math.max(0, Math.min(100, volume));

const volumeToNormalized = (volume: number): number => clampVolume(volume) / 100;

const normalizedToVolume = (normalized: number): number => Math.round(normalized * 100);

const getCurrentTimeMs = (video: HTMLVideoElement): number => secondsToMs(video.currentTime);

const getDurationMs = (video: HTMLVideoElement): number =>
  Number.isFinite(video.duration) ? secondsToMs(video.duration) : 0;

const isFullscreen = (element: HTMLVideoElement): boolean => document.fullscreenElement === element;
