import type * as TE from "fp-ts/TaskEither";
import type { PlayerState } from "../state";
import type * as Transitions from "../transitions";
import type { PlaybackErrors } from "./errors";
import type { PlaybackType } from "./types";

// ============================================================================
// Base Playback Abstract Class
// ============================================================================

/**
 * Abstract base class for all playback engines
 *
 * @template TConfig - Configuration type specific to the engine
 * @template TEngine - Underlying engine instance type (HTMLVideoElement, Hls, DashJS)
 */
export abstract class BasePlayback<TConfig, TEngine> {
  /** Discriminator tag for pattern matching */
  abstract readonly _tag: PlaybackType;

  /** Human-readable name */
  abstract readonly name: string;

  /** Source URL being played */
  readonly source: string;

  /** Reference to underlying engine instance */
  protected engine: TEngine | null = null;

  /** Configuration for this playback type */
  protected config: TConfig;

  /** Reference to video element */
  protected videoElement: HTMLVideoElement | null = null;

  constructor(data: { source: string; config: TConfig }) {
    this.source = data.source;
    this.config = data.config;
  }

  // ==========================================================================
  // Abstract Methods - Must be implemented by subclasses
  // ==========================================================================

  /**
   * Create the underlying engine instance
   *
   * @protected
   * @returns TaskEither with engine instance or error
   */
  protected abstract createEngine(): TE.TaskEither<PlaybackErrors.Any, TEngine>;

  /**
   * Initialize the engine with a video element
   *
   * @param videoElement - HTML video element to attach to
   * @returns TaskEither with void or error
   */
  abstract initialize(videoElement: HTMLVideoElement): TE.TaskEither<PlaybackErrors.Any, void>;

  /**
   * Load and prepare the source for playback
   *
   * @returns TaskEither with void or error
   */
  abstract load(): TE.TaskEither<PlaybackErrors.Any, void>;

  /**
   * Get current playback state
   *
   * @returns TaskEither with PlayerState or error
   */
  abstract getState(): TE.TaskEither<PlaybackErrors.Any, PlayerState.Any>;

  /**
   * Clean up resources and destroy engine
   *
   * @returns TaskEither with void (never fails)
   */
  abstract destroy(): TE.TaskEither<never, void>;

  // ==========================================================================
  // Shared Public Methods
  // ==========================================================================

  /**
   * Check if engine is initialized
   */
  isInitialized = (): boolean => this.engine !== null && this.videoElement !== null;

  /**
   * Get the underlying engine instance (if initialized)
   */
  getEngine = (): TEngine | null => this.engine;

  /**
   * Get the video element (if initialized)
   */
  getVideoElement = (): HTMLVideoElement | null => this.videoElement;

  /**
   * Get current configuration
   */
  getConfig = (): TConfig => this.config;

  // ==========================================================================
  // Playback Control Methods (using transitions)
  // ==========================================================================

  /**
   * Play the video
   */
  abstract play(): TE.TaskEither<PlaybackErrors.Any, PlayerState.Control.Playing>;

  /**
   * Pause the video
   */
  abstract pause(): TE.TaskEither<PlaybackErrors.Any, PlayerState.Control.Paused>;

  /**
   * Seek to a specific time
   */
  abstract seek(params: Transitions.SeekParams): TE.TaskEither<PlaybackErrors.Any, PlayerState.Control.Seeking>;

  /**
   * Set playback rate
   */
  abstract setPlaybackRate(rate: number): TE.TaskEither<PlaybackErrors.Any, void>;
}
