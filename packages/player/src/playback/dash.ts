/**
 * DASH Playback
 *
 * Playback engine using dash.js for MPEG-DASH support
 */

import { MediaPlayer, type MediaPlayerClass } from "dashjs";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { PlayerState } from "../state";
import { BasePlayback } from "./base";
import { EngineNotSupportedError, InitializationError, LoadError, PlaybackError, type PlaybackErrors } from "./errors";
import type { DASHConfig, ManifestInfo, QualityLevel } from "./types";

// ============================================================================
// DASH Playback Implementation
// ============================================================================

export class DASHPlayback extends BasePlayback<DASHConfig, MediaPlayerClass> {
  readonly _tag = "dash" as const;
  readonly name = "dash.js";

  private currentQuality: QualityLevel | null = null;
  private manifestInfo: ManifestInfo | null = null;

  // ==========================================================================
  // Engine Creation
  // ==========================================================================

  protected createEngine(): TE.TaskEither<PlaybackErrors.Any, MediaPlayerClass> {
    return pipe(
      TE.tryCatch(
        async () => {
          // Check if dash.js is available
          if (!MediaPlayer) {
            throw new EngineNotSupportedError("dash.js", "dash.js library not available", this);
          }

          // Create player instance
          const player = MediaPlayer().create();

          // Apply configuration
          if (this.config.dashSettings) {
            player.updateSettings(this.config.dashSettings);
          }

          if (this.config.debug) {
            player.updateSettings({
              debug: {
                logLevel: 4, // LOG_LEVEL_DEBUG
              },
            });
          }

          return player;
        },
        (error) =>
          error instanceof EngineNotSupportedError
            ? error
            : new InitializationError("Failed to create DASH engine", this, error),
      ),
    );
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  initialize(videoElement: HTMLVideoElement): TE.TaskEither<PlaybackErrors.Any, void> {
    return pipe(
      TE.tryCatch(
        async () => {
          // Create engine using createEngine result
          const engineResult = await this.createEngine()();
          if (E.isLeft(engineResult)) {
            throw engineResult.left;
          }
          const player = engineResult.right;

          this.engine = player;
          this.videoElement = videoElement;

          // Setup event listeners BEFORE initialize
          this.setupDASHEvents(player);

          // Initialize player with video element but NO source yet
          // Source will be attached in load()
          player.initialize(videoElement, undefined, false);

          // Wait for player to be ready
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Player initialization timeout"));
            }, 5000);

            // Player is ready immediately after initialize if no source provided
            clearTimeout(timeout);
            resolve();
          });
        },
        (error): PlaybackErrors.Any =>
          error instanceof PlaybackError
            ? (error as PlaybackErrors.Any)
            : new InitializationError("Failed to initialize DASH playback", this, error),
      ),
    );
  }

  // ==========================================================================
  // Loading
  // ==========================================================================

  load(): TE.TaskEither<PlaybackErrors.Any, void> {
    return pipe(
      TE.tryCatch(
        async () => {
          if (!this.engine) {
            throw new Error("Engine not initialized");
          }

          console.log("[DASH load] Attaching source:", this.source);

          // Simply attach source - dash.js will handle loading asynchronously
          // No need to wait for events, the player will emit them as it loads
          this.engine.attachSource(this.source);

          console.log("[DASH load] Source attached, dash.js will load in background");

          // Return immediately - dash.js loads asynchronously
          // State will be updated through getState() polling
        },
        (error) => {
          console.error("[DASH load] Load failed with error:", error);
          return new LoadError("Failed to load DASH MPD", this.source, this, error);
        },
      ),
    );
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  getState(): TE.TaskEither<PlaybackErrors.Any, PlayerState.Any> {
    return pipe(
      TE.tryCatch(
        async () => {
          if (!this.engine || !this.videoElement) {
            console.log("[DASH getState] No engine or video element");
            return new PlayerState.Control.Idle();
          }

          const video = this.videoElement;
          const player = this.engine;

          console.log(
            "[DASH getState] isReady:",
            player.isReady(),
            "paused:",
            video.paused,
            "readyState:",
            video.readyState,
            "currentTime:",
            video.currentTime,
          );

          // Get buffered ranges
          const buffered = [];
          for (let i = 0; i < video.buffered.length; i++) {
            buffered.push({
              start: video.buffered.start(i),
              end: video.buffered.end(i),
            });
          }

          // Standard video states (check these FIRST, before MPD states)
          if (video.ended) {
            return new PlayerState.Control.Ended(video.duration, video.loop);
          }

          if (video.seeking) {
            return new PlayerState.Control.Seeking(video.currentTime, video.currentTime, video.duration);
          }

          if (!video.paused && video.readyState >= 3) {
            return new PlayerState.Control.Playing(video.currentTime, video.duration, buffered, video.playbackRate);
          }

          if (video.readyState < 3 && !video.paused) {
            return new PlayerState.Control.Buffering(video.currentTime, video.duration, buffered, 0);
          }

          if (video.paused && video.readyState >= 2) {
            return new PlayerState.Control.Paused(video.currentTime, video.duration, buffered);
          }

          // Check if MPD is being loaded
          if (!player.isReady()) {
            return new PlayerState.Source.DASH.MPDLoading(this.source);
          }

          // Fallback to Paused if ready but not playing
          if (player.isReady()) {
            return new PlayerState.Control.Paused(video.currentTime, video.duration, buffered);
          }

          return new PlayerState.Control.Idle();
        },
        (error): PlaybackErrors.Any => new InitializationError("Failed to get DASH playback state", this, error),
      ),
    );
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  destroy(): TE.TaskEither<never, void> {
    return pipe(
      TE.of(() => {
        if (this.engine) {
          // Remove event listeners first
          this.removeDASHEvents(this.engine);

          // Reset the player (stops playback and clears buffer)
          this.engine.reset();

          this.engine = null;
          this.videoElement = null;
          this.currentQuality = null;
          this.manifestInfo = null;
        }
      }),
      TE.map(() => undefined),
    );
  }

  // ==========================================================================
  // DASH-Specific Methods
  // ==========================================================================

  /**
   * Get current quality level
   */
  getCurrentQuality(): TE.TaskEither<PlaybackErrors.Any, QualityLevel | null> {
    return TE.right(this.currentQuality);
  }

  /**
   * Get all available quality levels
   */
  getAvailableQualities(): TE.TaskEither<PlaybackErrors.Any, QualityLevel[]> {
    return TE.right(this.manifestInfo?.availableQualities || []);
  }

  /**
   * Set quality level
   */
  setQuality(_levelIndex: number): TE.TaskEither<PlaybackErrors.Any, void> {
    // Note: dash.js quality control API varies by version
    // This is a simplified implementation
    return TE.right(undefined);
  }

  /**
   * Get MPD manifest information
   */
  getManifestInfo(): TE.TaskEither<PlaybackErrors.Any, ManifestInfo | null> {
    return pipe(
      TE.tryCatch(
        async () => {
          if (!this.engine || !this.engine.isReady()) {
            return null;
          }

          this.manifestInfo = {
            duration: this.engine.duration() || 0,
            isDynamic: this.engine.isDynamic(),
            availableQualities: [],
          };

          return this.manifestInfo;
        },
        (error): PlaybackErrors.Any => new InitializationError("Failed to get manifest info", this, error),
      ),
    );
  }

  // ==========================================================================
  // Event Management
  // ==========================================================================

  private setupDASHEvents(player: MediaPlayerClass): void {
    player.on("manifestLoaded", this.handleManifestLoaded);
    player.on("streamInitialized", this.handleStreamInitialized);
    player.on("qualityChangeRequested", this.handleQualityChange);
    player.on("error", this.handleDASHError);
  }

  private removeDASHEvents(player: MediaPlayerClass): void {
    player.off("manifestLoaded", this.handleManifestLoaded);
    player.off("streamInitialized", this.handleStreamInitialized);
    player.off("qualityChangeRequested", this.handleQualityChange);
    player.off("error", this.handleDASHError);
  }

  private handleManifestLoaded = (_event: unknown): void => {
    // Trigger manifest info update
    if (this.engine) {
      this.getManifestInfo()();
    }
  };

  private handleStreamInitialized = (_event: unknown): void => {
    // Override in subclass if needed
  };

  private handleQualityChange = (event: { mediaType: string; newQuality: number }): void => {
    if (event.mediaType === "video" && this.manifestInfo) {
      this.currentQuality = this.manifestInfo.availableQualities[event.newQuality] || null;
    }
  };

  private handleDASHError = (event: { error: { code: string; message: string } }): void => {
    // Can be overridden to emit to state system
    console.error("DASH Error:", event.error);
  };
}
