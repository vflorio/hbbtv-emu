/**
 * WithVideoBackend Class Expression Mixin
 *
 * Provides low-level video playback capabilities through a unified Player interface.
 * This mixin handles only video management - no HbbTV-specific API logic.
 *
 * HbbTV-specific state mapping and API compliance should be handled by
 * the consuming classes (AvVideoMp4, AvVideoBroadcast, etc.)
 *
 * @example
 * ```typescript
 * class AvVideoMp4 extends WithVideoBackend(SomeBaseClass) {
 *   // Has access to this.player with unified interface
 *   // Map player events to HbbTV events in this class
 * }
 * ```
 */

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
  UnifiedPlayState,
} from "./types";

const logger = createLogger("VideoBackend");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Video backend interface provided by the mixin.
 * Contains only low-level video management functionality.
 */
export interface VideoStream {
  /** The underlying unified player instance */
  readonly player: Player;

  /** Current unified play state */
  readonly unifiedPlayState: UnifiedPlayState;

  /** Get the underlying video element (for DOM attachment) */
  getVideoElement(): HTMLVideoElement;

  /** Initialize the appropriate player based on source type */
  initializePlayer(sourceType: MediaSourceType): IO.IO<void>;

  /** Load and prepare a media source */
  loadSource(source: MediaSource): IO.IO<void>;

  /** Release the current player and clean up resources */
  releasePlayer(): IO.IO<void>;

  /** Subscribe to unified state changes */
  onUnifiedStateChange: (listener: (state: UnifiedPlayState, previousState: UnifiedPlayState) => void) => () => void;
}

/**
 * Constructor type for class expression pattern.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Player Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a player instance based on source type.
 */
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

/**
 * Detect source type from URL.
 */
const detectSourceType = (url: string): MediaSourceType => {
  const lowercaseUrl = url.toLowerCase();
  if (lowercaseUrl.endsWith(".mpd") || lowercaseUrl.includes("dash")) return "dash";
  if (lowercaseUrl.endsWith(".m3u8") || lowercaseUrl.includes("hls")) return "hls";
  return "video";
};

// ─────────────────────────────────────────────────────────────────────────────
// Mixin Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a class expression mixin that provides low-level video backend functionality.
 *
 * This mixin provides:
 * - Player management (create, load, release)
 * - Playback control (play, pause, stop, seek)
 * - Volume control
 * - Fullscreen control
 * - Event subscription
 *
 * It does NOT provide:
 * - HbbTV-specific state mapping (handle in consuming class)
 * - HbbTV API compliance (handle in consuming class)
 *
 * @example
 * ```typescript
 * class AvVideoMp4 extends WithVideoBackend(BaseClass) {
 *   constructor() {
 *     super();
 *     // Subscribe to unified state changes and map to HbbTV states
 *     this.onStateChange((state) => {
 *       this._playState = mapToAvControlState(state);
 *       this.onPlayStateChange?.(this._playState);
 *     });
 *   }
 * }
 * ```
 */
export class ObjectVideoStream implements VideoStream {
  #player: Player = new HtmlVideoPlayer();
  #currentSourceType: MediaSourceType = "video";
  #stateChangeListeners: Set<(state: UnifiedPlayState, previousState: UnifiedPlayState) => void> = new Set();

  constructor() {
    this.#setupStateChangeListener();
    logger.info("initialized")();
  }

  get player(): Player {
    return this.#player;
  }

  get unifiedPlayState(): UnifiedPlayState {
    return this.#player.state;
  }

  getVideoElement = (): HTMLVideoElement => {
    return this.#player.getElement();
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Internal Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set up a listener to forward state changes.
   */
  #setupStateChangeListener = (): void => {
    this.#player.on("statechange", (event) => {
      logger.debug("Unified state change:", event.previousState, "->", event.state)();

      for (const listener of this.#stateChangeListeners) {
        try {
          listener(event.state, event.previousState);
        } catch (err) {
          logger.error("State change listener error:", err)();
        }
      }
    });
  };

  /**
   * Subscribe to unified state changes.
   * Use this to map unified states to HbbTV-specific states in consuming classes.
   */
  onUnifiedStateChange = (
    listener: (state: UnifiedPlayState, previousState: UnifiedPlayState) => void,
  ): (() => void) => {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Low-Level Playback Control (delegate to player)
  // ═══════════════════════════════════════════════════════════════════════════

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
}
