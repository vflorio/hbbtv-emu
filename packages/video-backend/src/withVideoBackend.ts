/**
 * WithVideoBackend Class Expression Mixin
 *
 * Provides video playback capabilities through a unified Player interface.
 * Can be configured for either AVControl or VideoBroadcast APIs, handling
 * the state mapping automatically.
 *
 * @example
 * ```typescript
 * class AvVideoMp4 extends WithVideoBackend("avControl")(SomeBaseClass) {
 *   // Has access to this.player with unified interface
 *   // State changes automatically map to AVControl.PlayState
 * }
 *
 * class VideoBroadcast extends WithVideoBackend("avBroadcast")(SomeBaseClass) {
 *   // State changes automatically map to VideoBroadcast.PlayState
 * }
 * ```
 */

import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { createDashPlayer } from "./dashPlayer";
import { createHlsPlayer } from "./hlsPlayer";
import { createHtmlVideoPlayer } from "./htmlVideoPlayer";
import { type AVControlPlayState, unifiedToApiState, type VideoBroadcastPlayState } from "./stateMapping";
import type { ApiType, MediaSource, MediaSourceType, Player, PlayerEventListener, PlayerEventType } from "./types";

const logger = createLogger("VideoBackend");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * State type based on API type.
 */
export type ApiPlayState<T extends ApiType> = T extends "avControl" ? AVControlPlayState : VideoBroadcastPlayState;

/**
 * Video backend interface provided by the mixin.
 */
export interface VideoBackendInterface<T extends ApiType> {
  /** The underlying unified player instance */
  readonly player: Player;

  /** The API type this backend is configured for */
  readonly apiType: T;

  /** Current play state in API-specific format */
  readonly apiPlayState: ApiPlayState<T>;

  /** Get the underlying video element (for DOM attachment) */
  getVideoElement(): HTMLVideoElement;

  /** Initialize the appropriate player based on source type */
  initializePlayer(sourceType: MediaSourceType): IO.IO<void>;

  /** Load and prepare a media source */
  loadSource(source: MediaSource): IO.IO<void>;

  /** Release the current player and clean up resources */
  releasePlayer(): IO.IO<void>;
}

/**
 * Constructor type for class expression pattern.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for mixin pattern
type Constructor<T = object> = new (...args: any[]) => T;

// ─────────────────────────────────────────────────────────────────────────────
// Player Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a player instance based on source type.
 */
const createPlayer = (sourceType: MediaSourceType): Player => {
  switch (sourceType) {
    case "dash":
      return createDashPlayer();
    case "hls":
      return createHlsPlayer();
    case "native":
    case "broadcast":
    default:
      return createHtmlVideoPlayer();
  }
};

/**
 * Detect source type from URL.
 */
const detectSourceType = (url: string): MediaSourceType => {
  const lowercaseUrl = url.toLowerCase();

  if (lowercaseUrl.endsWith(".mpd") || lowercaseUrl.includes("dash")) {
    return "dash";
  }
  if (lowercaseUrl.endsWith(".m3u8") || lowercaseUrl.includes("hls")) {
    return "hls";
  }
  if (lowercaseUrl.startsWith("dvb://") || lowercaseUrl.includes("broadcast")) {
    return "broadcast";
  }
  return "native";
};

// ─────────────────────────────────────────────────────────────────────────────
// Mixin Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a class expression mixin that provides video backend functionality.
 *
 * @param apiType - The HbbTV API type to configure state mapping for
 * @returns A class expression mixin that adds VideoBackendInterface
 *
 * @example
 * ```typescript
 * // For A/V Control objects (video/mp4, video/dash, audio/*)
 * class AvVideoMp4 extends WithVideoBackend("avControl")(BaseClass) {
 *   playback() {
 *     this.player.play();
 *     console.log(this.apiPlayState); // AVControl.PlayState value
 *   }
 * }
 *
 * // For Video/Broadcast objects
 * class VideoBroadcast extends WithVideoBackend("avBroadcast")(BaseClass) {
 *   tune() {
 *     this.loadSource({ url: "dvb://..." })();
 *     console.log(this.apiPlayState); // VideoBroadcast.PlayState value
 *   }
 * }
 * ```
 */
export const WithVideoBackend = <T extends ApiType>(apiType: T) => {
  return <TBase extends Constructor>(Base: TBase) => {
    return class VideoBackendMixin extends Base implements VideoBackendInterface<T> {
      // ═════════════════════════════════════════════════════════════════════════
      // Private State
      // ═════════════════════════════════════════════════════════════════════════

      #player: Player = createHtmlVideoPlayer();
      #currentSourceType: MediaSourceType = "native";
      #stateChangeListeners: Set<(state: ApiPlayState<T>) => void> = new Set();

      // ═════════════════════════════════════════════════════════════════════════
      // VideoBackendInterface Implementation
      // ═════════════════════════════════════════════════════════════════════════

      readonly apiType: T = apiType;

      get player(): Player {
        return this.#player;
      }

      get apiPlayState(): ApiPlayState<T> {
        return unifiedToApiState(apiType, this.#player.state) as ApiPlayState<T>;
      }

      getVideoElement = (): HTMLVideoElement => {
        return this.#player.getVideoElement();
      };

      /**
       * Initialize a new player for the given source type.
       * This will release the current player if switching types.
       */
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

      /**
       * Load a media source into the player.
       * Automatically detects source type and initializes appropriate player.
       */
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

      /**
       * Release the current player and clean up resources.
       */
      releasePlayer = (): IO.IO<void> =>
        pipe(
          logger.debug("Releasing player"),
          IO.flatMap(() =>
            IO.of(() => {
              this.#player.release();
            }),
          ),
        );

      // ═════════════════════════════════════════════════════════════════════════
      // Internal Methods
      // ═════════════════════════════════════════════════════════════════════════

      /**
       * Set up a listener to forward state changes.
       */
      #setupStateChangeListener = (): void => {
        this.#player.on("statechange", (event) => {
          const apiState = unifiedToApiState(apiType, event.state) as ApiPlayState<T>;
          logger.debug("State change:", event.previousState, "->", event.state, "API state:", apiState)();

          for (const listener of this.#stateChangeListeners) {
            try {
              listener(apiState);
            } catch (err) {
              logger.error("State change listener error:", err)();
            }
          }
        });
      };

      /**
       * Subscribe to API-specific state changes.
       */
      onApiStateChange = (listener: (state: ApiPlayState<T>) => void): (() => void) => {
        this.#stateChangeListeners.add(listener);
        return () => this.#stateChangeListeners.delete(listener);
      };

      /**
       * Forward player events to a listener.
       */
      onPlayerEvent = <E extends PlayerEventType>(type: E, listener: PlayerEventListener<E>): (() => void) => {
        this.#player.on(type, listener);
        return () => this.#player.off(type, listener);
      };

      // ═════════════════════════════════════════════════════════════════════════
      // Convenience Methods (delegate to player)
      // ═════════════════════════════════════════════════════════════════════════

      /** Start or resume playback */
      backendPlay = (speed = 1): void => this.#player.play(speed);

      /** Pause playback */
      backendPause = (): void => this.#player.pause();

      /** Stop playback and reset position */
      backendStop = (): void => this.#player.stop();

      /** Seek to position (milliseconds) */
      backendSeek = (position: number): void => this.#player.seek(position);

      /** Set volume (0-100) */
      backendSetVolume = (volume: number): void => this.#player.setVolume(volume);

      /** Set muted state */
      backendSetMuted = (muted: boolean): void => this.#player.setMuted(muted);

      /** Set fullscreen state */
      backendSetFullscreen = (fullscreen: boolean): void => this.#player.setFullscreen(fullscreen);

      /** Set dimensions */
      backendSetSize = (width: number, height: number): void => this.#player.setSize(width, height);

      // ═════════════════════════════════════════════════════════════════════════
      // Constructor
      // ═════════════════════════════════════════════════════════════════════════

      constructor(...args: any[]) {
        super(...args);
        this.#setupStateChangeListener();
        logger.info("Initialized with API type:", apiType)();
      }
    };
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Type Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the mixin instance type.
 */
export type VideoBackendMixin<T extends ApiType> = InstanceType<ReturnType<ReturnType<typeof WithVideoBackend<T>>>>;
