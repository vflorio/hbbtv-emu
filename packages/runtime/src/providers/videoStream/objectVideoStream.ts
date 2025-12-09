// ObjectVideoStream - low-level video playback via stream Player interface

import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { DashPlayer } from "./players/dash";
import { HlsPlayer } from "./players/hls";
import { HtmlVideoPlayer } from "./players/video";
import type {
  MediaSource,
  MediaSourceType,
  Player,
  PlayerEventListener,
  PlayerEventType,
  StreamPlayState,
} from "./types";

const logger = createLogger("VideoBackend");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

// Video backend interface with low-level video management
export interface VideoStream {
  readonly player: Player;
  readonly streamPlayState: StreamPlayState;
  readonly videoElement: HTMLVideoElement;
  initializePlayer(sourceType: MediaSourceType): IO.IO<void>;
  loadSource(source: MediaSource): IO.IO<void>;
  releasePlayer(): IO.IO<void>;
  onStreamStateChange: (listener: (state: StreamPlayState, previousState: StreamPlayState) => void) => () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Player Factory
// ─────────────────────────────────────────────────────────────────────────────

const createPlayer = (sourceType: MediaSourceType): Player => {
  switch (sourceType) {
    case "dash":
      return new DashPlayer();
    case "hls":
      return new HlsPlayer();
    case "video":
      return new HtmlVideoPlayer();
  }
};

const detectSourceType = (url: string): MediaSourceType => {
  const lowercaseUrl = url.toLowerCase();
  if (lowercaseUrl.endsWith(".mpd") || lowercaseUrl.includes("dash")) return "dash";
  if (lowercaseUrl.endsWith(".m3u8") || lowercaseUrl.includes("hls")) return "hls";
  return "video";
};

// ─────────────────────────────────────────────────────────────────────────────
// ObjectVideoStream
// ─────────────────────────────────────────────────────────────────────────────

export class ObjectVideoStream implements VideoStream {
  #player: Player = new HtmlVideoPlayer();
  #currentSourceType: MediaSourceType = "video";
  #stateChangeListeners: Set<(state: StreamPlayState, previousState: StreamPlayState) => void> = new Set();

  constructor() {
    this.#setupStateChangeListener();
    logger.info("initialized")();
  }

  initializePlayer = (sourceType: MediaSourceType): IO.IO<void> =>
    pipe(
      logger.debug("Initializing player for source type:", sourceType),
      IO.flatMap(() =>
        sourceType !== this.#currentSourceType
          ? pipe(
              this.releasePlayer(),
              IO.flatMap(() =>
                IO.of(() => {
                  this.#player = createPlayer(sourceType);
                  this.#currentSourceType = sourceType;
                  this.#setupStateChangeListener();
                }),
              ),
            )
          : IO.of(undefined),
      ),
    );

  loadSource = (source: MediaSource): IO.IO<void> =>
    pipe(
      logger.debug("Loading source:", source.url),
      IO.flatMap(() => {
        const sourceType = source.type ?? detectSourceType(source.url);
        return pipe(
          this.initializePlayer(sourceType),
          IO.flatMap(() =>
            IO.of(() => {
              this.#player.load(source);
            }),
          ),
        );
      }),
    );

  releasePlayer = (): IO.IO<void> =>
    pipe(
      logger.debug("Releasing player"),
      IO.flatMap(() =>
        IO.of(() => {
          this.#player.release();
        }),
      ),
    );

  // ═════════════════════════════════════════════════════════════════════════════
  // Internal Methods
  // ═════════════════════════════════════════════════════════════════════════════

  #setupStateChangeListener = (): void => {
    this.#player.on("statechange", (event) => {
      logger.debug("Stream state change:", event.previousState, "->", event.state)();

      for (const listener of this.#stateChangeListeners) {
        try {
          listener(event.state, event.previousState);
        } catch (err) {
          logger.error("State change listener error:", err)();
        }
      }
    });
  };

  onStreamStateChange = (listener: (state: StreamPlayState, previousState: StreamPlayState) => void): (() => void) => {
    this.#stateChangeListeners.add(listener);
    return () => this.#stateChangeListeners.delete(listener);
  };

  onPlayerEvent = <E extends PlayerEventType>(type: E, listener: PlayerEventListener<E>): (() => void) => {
    this.#player.on(type, listener);
    return () => this.#player.off(type, listener);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Low-Level Playback Control (delegate to player)
  // ═══════════════════════════════════════════════════════════════════════════

  get player(): Player {
    return this.#player;
  }

  get streamPlayState(): StreamPlayState {
    return this.#player.state;
  }

  get videoElement(): HTMLVideoElement {
    return this.#player.getElement();
  }

  backendPlay = (speed = 1): void => this.#player.play(speed);
  backendPause = (): void => this.#player.pause();
  backendStop = (): void => this.#player.stop();
  backendSeek = (position: number): void => this.#player.seek(position);
  backendSetVolume = (volume: number): void => this.#player.setVolume(volume);
  backendSetMuted = (muted: boolean): void => this.#player.setMuted(muted);
  backendSetFullscreen = (fullscreen: boolean): void => this.#player.setFullscreen(fullscreen);
  backendSetSize = (width: number, height: number): void => this.#player.setSize(width, height);
}
