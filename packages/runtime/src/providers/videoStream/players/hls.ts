/**
 * HLS.js Player
 *
 * Player implementation using HLS.js for HLS adaptive streaming.
 */

import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type Hls from "hls.js";
import type { MediaSource, Player, PlayerError, PlayerEvent, PlayerEventListener, PlayerEventType } from "../types";
import { StreamPlayState } from "../types";

const logger = createLogger("HlsPlayer");

/**
 * HLS.js Player implementation.
 * Manages HLS.js lifecycle, event handling, and playback control.
 */
export class HlsPlayer implements Player {
  readonly #videoElement: HTMLVideoElement;
  readonly #listeners: EventListeners;
  #hlsPlayer: Hls | null = null;
  #state: StreamPlayState = StreamPlayState.IDLE;
  #source: MediaSource | null = null;
  #currentSpeed = 1;

  constructor() {
    this.#videoElement = document.createElement("video");
    this.#listeners = createEventListeners();
    this.#setupVideoEventListeners()();
  }

  readonly #initHlsPlayer = async (): Promise<Hls> => {
    if (this.#hlsPlayer) {
      return this.#hlsPlayer;
    }

    // Dynamic import to avoid loading hls.js if not needed
    const HlsModule = await import("hls.js");
    const HlsClass = HlsModule.default;

    if (!HlsClass.isSupported()) {
      throw new Error("HLS.js is not supported in this browser");
    }

    this.#hlsPlayer = new HlsClass({
      enableWorker: true,
      lowLatencyMode: false,
    });

    this.#hlsPlayer.attachMedia(this.#videoElement);

    this.#setupHlsEventHandlers(this.#hlsPlayer, HlsClass);

    return this.#hlsPlayer;
  };

  readonly #setupHlsEventHandlers = (hls: Hls, HlsClass: typeof import("hls.js").default): void => {
    hls.on(HlsClass.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        pipe(
          this.#setState(StreamPlayState.ERROR),
          IO.flatMap(() => this.#emit("error", { error: createHlsError(data) })),
        )();
      }
    });

    hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
      logger.debug("HLS manifest parsed")();
    });

    hls.on(HlsClass.Events.FRAG_BUFFERED, () => {
      if (this.#state === StreamPlayState.BUFFERING) {
        this.#setState(StreamPlayState.PLAYING)();
      }
    });
  };

  readonly #setupVideoEventListeners = (): IO.IO<void> =>
    IO.of(() => {
      this.#videoElement.addEventListener("playing", () => {
        this.#setState(StreamPlayState.PLAYING)();
      });

      this.#videoElement.addEventListener("pause", () => {
        if (this.#state === StreamPlayState.PLAYING) {
          this.#setState(StreamPlayState.PAUSED)();
        }
      });

      this.#videoElement.addEventListener("ended", () => {
        pipe(
          this.#setState(StreamPlayState.FINISHED),
          IO.flatMap(() => this.#emit("ended", {})),
        )();
      });

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
    (newState: StreamPlayState): IO.IO<void> =>
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

  get state(): StreamPlayState {
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
      logger.debug("Loading HLS source:", newSource.url),
      IO.flatMap(() =>
        IO.of(() => {
          this.#source = newSource;
        }),
      ),
      IO.flatMap(() => this.#setState(StreamPlayState.CONNECTING)),
      IO.flatMap(() =>
        IO.of(() => {
          this.#initHlsPlayer()
            .then((hls) => {
              hls.loadSource(newSource.url);
            })
            .catch((err) => {
              logger.error("HLS init failed:", err)();
              pipe(
                this.#setState(StreamPlayState.ERROR),
                IO.flatMap(() => this.#emit("error", { error: { code: 0, message: String(err) } })),
              )();
            });
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
            this.#videoElement.play().catch((err) => {
              logger.error("Play failed:", err)();
              pipe(
                this.#setState(StreamPlayState.ERROR),
                IO.flatMap(() => this.#emit("error", { error: { code: 0, message: String(err) } })),
              )();
            });
          }
        }),
      ),
    )();
  };

  pause = (): void => {
    pipe(
      logger.debug("Pause"),
      IO.flatMap(() => IO.of(() => this.#videoElement.pause())),
    )();
  };

  stop = (): void => {
    pipe(
      logger.debug("Stop"),
      IO.flatMap(() =>
        IO.of(() => {
          this.#videoElement.pause();
          this.#videoElement.currentTime = 0;
        }),
      ),
      IO.flatMap(() => this.#setState(StreamPlayState.STOPPED)),
    )();
  };

  seek = (position: number): void => {
    pipe(
      logger.debug("Seek:", position),
      IO.flatMap(() =>
        IO.of(() => {
          const posSeconds = msToSeconds(position);
          if (posSeconds >= 0 && posSeconds <= this.#videoElement.duration) {
            this.#videoElement.currentTime = posSeconds;
          }
        }),
      ),
    )();
  };

  release = (): void => {
    pipe(
      logger.debug("Release"),
      IO.flatMap(() =>
        IO.of(() => {
          this.#hlsPlayer?.destroy();
          this.#hlsPlayer = null;
          this.#source = null;
        }),
      ),
      IO.flatMap(() => this.#setState(StreamPlayState.IDLE)),
    )();
  };

  // Audio Control

  setVolume = (volume: number): void => {
    this.#videoElement.volume = volumeToNormalized(volume);
  };

  setMuted = (muted: boolean): void => {
    this.#videoElement.muted = muted;
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

const createHlsError = (data: { type: string; details: string }): PlayerError => ({
  code: data.details ? 1 : 0,
  message: `HLS error: ${data.type} - ${data.details}`,
  details: data,
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
