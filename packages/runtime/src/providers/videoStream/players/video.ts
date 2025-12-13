// HTML Video Player - native HTMLVideoElement implementation

import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { MediaSource, Player, PlayerError, PlayerEvent, PlayerEventListener, PlayerEventType } from "../types";
import { StreamPlayState } from "../types";

const logger = createLogger("HtmlVideoPlayer");

export class HtmlVideoPlayer implements Player {
  readonly #videoElement: HTMLVideoElement;
  readonly #listeners: EventListeners;
  #state: StreamPlayState = StreamPlayState.IDLE;
  #source: MediaSource | null = null;
  #currentSpeed = 1;

  constructor() {
    this.#videoElement = document.createElement("video");
    this.#listeners = createEventListeners();
    this.#setupVideoEventListeners()();
  }

  readonly #setupVideoEventListeners = (): IO.IO<void> => () => {
    this.#videoElement.addEventListener("loadstart", () => {
      if (this.#state === StreamPlayState.IDLE) {
        this.#setState(StreamPlayState.CONNECTING)();
      }
    });

    this.#videoElement.addEventListener("playing", () => {
      this.#setState(StreamPlayState.PLAYING)();
    });

    this.#videoElement.addEventListener("pause", () => {
      if (this.#state === StreamPlayState.PLAYING) {
        this.#setState(StreamPlayState.PAUSED)();
      }
    });

    this.#videoElement.addEventListener("waiting", () => {
      if (this.#state === StreamPlayState.PLAYING) {
        this.#setState(StreamPlayState.BUFFERING)();
      }
    });

    this.#videoElement.addEventListener("ended", () => {
      pipe(
        this.#setState(StreamPlayState.FINISHED),
        IO.flatMap(() => this.#emit("ended", {})),
      )();
    });

    this.#videoElement.addEventListener("error", () => {
      pipe(
        this.#setState(StreamPlayState.ERROR),
        IO.flatMap(() => this.#emit("error", { error: createVideoError(this.#videoElement) })),
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
  };

  readonly #emit = <T extends PlayerEventType>(
    type: T,
    data: Omit<PlayerEvent<T>, "type" | "timestamp">,
  ): IO.IO<void> =>
    pipe(
      IO.of(createPlayerEvent(type, data)),
      IO.flatMap((event) => () => {
        for (const listener of this.#listeners[type]) {
          try {
            (listener as PlayerEventListener<T>)(event);
          } catch (err) {
            logger.error("Event listener error:", err)();
          }
        }
      }),
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
      logger.debug("Loading source:", newSource.url),
      IO.flatMap(() => () => {
        this.#source = newSource;
        this.#videoElement.autoplay = newSource.autoPlay ?? false;
        this.#videoElement.muted = newSource.muted ?? false;
        this.#videoElement.loop = newSource.loop ?? false;
        this.#videoElement.src = newSource.url;
        this.#videoElement.load();
      }),
      IO.flatMap(() => this.#setState(StreamPlayState.CONNECTING)),
    )();
  };

  play = (speed = 1): void => {
    pipe(
      logger.debug("Play:", speed),
      IO.flatMap(() => () => {
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
    )();
  };

  pause = (): void => {
    pipe(
      logger.debug("Pause"),
      IO.flatMap(() => () => this.#videoElement.pause()),
    )();
  };

  stop = (): void => {
    pipe(
      logger.debug("Stop"),
      IO.flatMap(() => () => {
        this.#videoElement.pause();
        this.#videoElement.currentTime = 0;
      }),
      IO.flatMap(() => this.#setState(StreamPlayState.STOPPED)),
    )();
  };

  seek = (position: number): void => {
    pipe(
      logger.debug("Seek:", position),
      IO.flatMap(() => () => {
        const posSeconds = msToSeconds(position);
        if (posSeconds >= 0 && posSeconds <= this.#videoElement.duration) {
          this.#videoElement.currentTime = posSeconds;
        }
      }),
    )();
  };

  release = (): void => {
    pipe(
      logger.debug("Release"),
      IO.flatMap(() => () => {
        this.#videoElement.pause();
        this.#videoElement.removeAttribute("src");
        this.#videoElement.load();
        this.#source = null;
      }),
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

const createVideoError = (video: HTMLVideoElement): PlayerError => ({
  code: video.error?.code ?? 0,
  message: video.error?.message ?? "Unknown error",
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
