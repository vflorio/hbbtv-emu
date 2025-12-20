/**
 * Playback engine for HLS (HTTP Live Streaming)
 */

import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import Hls, { type ErrorData, Events } from "hls.js";
import { type HLSVariant, PlayerState } from "../../state";
import * as Transitions from "../../transitions";
import { BasePlayback } from "../base";
import { EngineNotSupportedError, InitializationError, LoadError, PlaybackError, type PlaybackErrors } from "../errors";
import type { HLSConfig, QualityLevel } from "../types";

// ============================================================================
// HLS Playback Implementation
// ============================================================================

export class HLSPlayback extends BasePlayback<HLSConfig, Hls> {
  readonly _tag = "hls" as const;
  readonly name = "HLS.js";

  private currentQuality: QualityLevel | null = null;

  // ==========================================================================
  // Engine Creation
  // ==========================================================================

  protected createEngine(): TE.TaskEither<PlaybackErrors.Any, Hls> {
    return pipe(
      TE.tryCatch(
        async () => {
          // Check support
          if (!Hls.isSupported()) {
            throw new EngineNotSupportedError("HLS.js", "MediaSource API not available", this);
          }

          // Create instance with config
          const hls = new Hls({
            ...this.config.hlsConfig,
            startLevel: this.config.startLevel,
            autoStartLoad: this.config.autoStartLoad ?? true,
            debug: this.config.debug ?? false,
          });

          return hls;
        },
        (error) =>
          error instanceof EngineNotSupportedError
            ? error
            : new InitializationError("Failed to create HLS engine", this, error),
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
          const hls = engineResult.right;

          this.engine = hls;
          this.videoElement = videoElement;

          // Setup event listeners BEFORE attaching media
          this.setupHLSEvents(hls);

          // Check if media is already attached
          if (hls.media === videoElement) {
            console.log("[HLS] Media already attached, skipping attachment");
            return;
          }

          // Attach media
          hls.attachMedia(videoElement);

          // Wait for media attached
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Media attachment timeout"));
            }, 10000); // Increased timeout

            const onAttached = () => {
              clearTimeout(timeout);
              hls.off(Events.ERROR, onError);
              resolve();
            };

            const onError = (_event: string, data: ErrorData) => {
              if (data.fatal) {
                clearTimeout(timeout);
                hls.off(Events.MEDIA_ATTACHED, onAttached);
                reject(new Error(`HLS error: ${data.type} - ${data.details}`));
              }
            };

            hls.once(Events.MEDIA_ATTACHED, onAttached);
            hls.once(Events.ERROR, onError);
          });
        },
        (error): PlaybackErrors.Any =>
          error instanceof PlaybackError
            ? (error as PlaybackErrors.Any)
            : new InitializationError("Failed to initialize HLS playback", this, error),
      ),
    );
  }

  // ==========================================================================
  // Loading
  // ==========================================================================

  load(): TE.TaskEither<PlaybackErrors.Any, void> {
    return pipe(
      // Use transition to create Loading state
      Transitions.loadSource({
        url: this.source,
        sourceType: "hls",
        autoplay: false,
      }),
      TE.mapLeft(
        (stateError) =>
          // Convert state error to playback error
          new LoadError("Failed to create loading state", this.source, this, stateError),
      ),
      TE.flatMap(() =>
        TE.tryCatch(
          async () => {
            if (!this.engine) {
              throw new Error("Engine not initialized");
            }

            this.engine.loadSource(this.source);

            // Wait for manifest parsed
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error("Manifest loading timeout"));
              }, 10000);

              this.engine!.once(Hls.Events.MANIFEST_PARSED, () => {
                clearTimeout(timeout);
                resolve();
              });

              this.engine!.once(Hls.Events.ERROR, (_event, data) => {
                clearTimeout(timeout);
                reject(data);
              });
            });
          },
          (error) => new LoadError("Failed to load HLS manifest", this.source, this, error),
        ),
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
            return new PlayerState.Control.Idle();
          }

          const video = this.videoElement;
          const hls = this.engine;

          // Get buffered ranges
          const buffered = [];
          for (let i = 0; i < video.buffered.length; i++) {
            buffered.push({
              start: video.buffered.start(i),
              end: video.buffered.end(i),
            });
          }

          // Check if levels are available (manifest parsed)
          if (hls.levels.length === 0) {
            return new PlayerState.Source.HLS.ManifestLoading(this.source);
          }

          // Check if manifest is parsed
          if (hls.levels.length > 0 && !this.currentQuality) {
            const levels = hls.levels.map((level) => ({
              bandwidth: level.bitrate,
              resolution: { width: level.width, height: level.height },
              codecs: level.videoCodec || level.audioCodec || "unknown",
              url: level.url[0],
            }));

            return new PlayerState.Source.HLS.ManifestParsed(this.source, levels, video.duration || 0);
          }

          // Check current quality
          if (hls.currentLevel >= 0 && hls.levels[hls.currentLevel]) {
            const level = hls.levels[hls.currentLevel];
            this.currentQuality = {
              index: hls.currentLevel,
              bitrate: level.bitrate,
              resolution: { width: level.width, height: level.height },
              codec: level.videoCodec,
            };
          }

          // Standard video states
          if (video.ended) {
            return new PlayerState.Control.Ended(video.duration, video.loop);
          }

          if (video.seeking) {
            return new PlayerState.Control.Seeking(video.currentTime, video.currentTime, video.duration);
          }

          if (video.readyState < 3 && !video.paused) {
            return new PlayerState.Control.Buffering(video.currentTime, video.duration, buffered, 0);
          }

          if (!video.paused) {
            return new PlayerState.Control.Playing(video.currentTime, video.duration, buffered, video.playbackRate);
          }

          return new PlayerState.Control.Paused(video.currentTime, video.duration, buffered);
        },
        (error): PlaybackErrors.Any => new InitializationError("Failed to get HLS playback state", this, error),
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
          // Stop loading and playback first
          this.engine.stopLoad();

          // Detach media if attached
          if (this.videoElement) {
            this.engine.detachMedia();
          }

          // Remove event listeners
          this.removeHLSEvents(this.engine);

          // Destroy the HLS instance
          this.engine.destroy();
          this.engine = null;
          this.videoElement = null;
          this.currentQuality = null;
        }
      }),
      TE.map(() => undefined),
    );
  }

  // ==========================================================================
  // HLS-Specific Methods
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
    return pipe(
      TE.tryCatch(
        async () => {
          if (!this.engine) {
            return [];
          }

          return this.engine.levels.map((level, index) => ({
            index,
            bitrate: level.bitrate,
            resolution: { width: level.width, height: level.height },
            codec: level.videoCodec,
          }));
        },
        (error): PlaybackErrors.Any => new InitializationError("Failed to get quality levels", this, error),
      ),
    );
  }

  /**
   * Set quality level
   */
  setQuality(levelIndex: number): TE.TaskEither<PlaybackErrors.Any, void> {
    return pipe(
      TE.tryCatch(
        async () => {
          if (!this.engine) {
            throw new Error("Engine not initialized");
          }

          this.engine.currentLevel = levelIndex;
        },
        (error): PlaybackErrors.Any => new InitializationError("Failed to set quality level", this, error),
      ),
    );
  }

  /**
   * Select HLS variant using transition
   */
  selectVariant(
    variant: Transitions.VariantSelectionParams,
  ): TE.TaskEither<PlaybackErrors.Any, PlayerState.Source.HLS.VariantSelected> {
    return pipe(
      this.getState(),
      TE.flatMap((state) => {
        // Ensure we're in a state where we have parsed manifest
        if (state._tag !== "Source/HLS/ManifestParsed") {
          return TE.left(new InitializationError(`Cannot select variant from state: ${state._tag}`, this));
        }

        // Use transition function
        return pipe(
          Transitions.selectHLSVariant(state, variant),
          E.fold(
            (error) => TE.left(new InitializationError(error.message, this, error)),
            (result) => TE.right(result),
          ),
        );
      }),
      // Apply the variant selection to the engine
      TE.tap((variantSelected) =>
        TE.tryCatch(
          async () => {
            if (!this.engine) {
              throw new Error("Engine not initialized");
            }
            // Find the level index for this variant
            const levelIndex = this.engine.levels.findIndex(
              (level) => level.bitrate === variantSelected.variant.bandwidth,
            );
            if (levelIndex >= 0) {
              this.engine.currentLevel = levelIndex;
            }
          },
          (error): PlaybackErrors.Any => new InitializationError("Failed to apply variant selection", this, error),
        ),
      ),
    );
  }

  /**
   * Switch to a new HLS variant (for adaptive streaming)
   */
  switchVariant(
    newVariant: HLSVariant,
    reason: "bandwidth" | "manual",
  ): TE.TaskEither<PlaybackErrors.Any, PlayerState.Source.HLS.AdaptiveSwitching> {
    return pipe(
      this.getState(),
      TE.flatMap((state) => {
        // Ensure we have a current variant selected
        if (state._tag !== "Source/HLS/VariantSelected" && !this.currentQuality) {
          return TE.left(new InitializationError(`Cannot switch variant from state: ${state._tag}`, this));
        }

        // Get current variant
        const currentLevel = this.engine?.levels[this.currentQuality?.index ?? 0];
        if (!currentLevel) {
          return TE.left(new InitializationError("No current level available", this));
        }

        const currentVariantData: HLSVariant = {
          bandwidth: currentLevel.bitrate,
          resolution: { width: currentLevel.width, height: currentLevel.height },
          codecs: currentLevel.videoCodec || "unknown",
          url: currentLevel.url[0],
        };

        // Create a VariantSelected state for the current variant
        const currentVariantState = new PlayerState.Source.HLS.VariantSelected(
          currentVariantData,
          currentVariantData.bandwidth,
          currentVariantData.resolution,
        );

        // Use transition function
        return pipe(
          Transitions.switchHLSVariant(currentVariantState, newVariant, reason),
          E.fold(
            () => TE.left(new InitializationError("Failed to create switching state", this)),
            (result) => TE.right(result),
          ),
        );
      }),
      // Apply the variant switch to the engine
      TE.tap((switching) =>
        TE.tryCatch(
          async () => {
            if (!this.engine) {
              throw new Error("Engine not initialized");
            }
            // Find the level index for the new variant
            const levelIndex = this.engine.levels.findIndex((level) => level.bitrate === switching.toVariant.bandwidth);
            if (levelIndex >= 0) {
              this.engine.currentLevel = levelIndex;
            }
          },
          (error): PlaybackErrors.Any => new InitializationError("Failed to apply variant switch", this, error),
        ),
      ),
    );
  }

  // ==========================================================================
  // Event Management
  // ==========================================================================

  private setupHLSEvents(hls: Hls): void {
    hls.on(Events.MANIFEST_PARSED, this.handleManifestParsed);
    hls.on(Events.LEVEL_SWITCHED, this.handleLevelSwitched);
    hls.on(Events.ERROR, this.handleHLSError);
    hls.on(Events.FRAG_LOADED, this.handleFragmentLoaded);
  }

  private removeHLSEvents(hls: Hls): void {
    hls.off(Events.MANIFEST_PARSED, this.handleManifestParsed);
    hls.off(Events.LEVEL_SWITCHED, this.handleLevelSwitched);
    hls.off(Events.ERROR, this.handleHLSError);
    hls.off(Events.FRAG_LOADED, this.handleFragmentLoaded);
  }

  private handleManifestParsed = (): void => {
    // Override in subclass if needed
  };

  private handleLevelSwitched = (_event: string, data: { level: number }): void => {
    if (this.engine?.levels[data.level]) {
      const level = this.engine.levels[data.level];
      this.currentQuality = {
        index: data.level,
        bitrate: level.bitrate,
        resolution: { width: level.width, height: level.height },
        codec: level.videoCodec,
      };
    }
  };

  private handleFragmentLoaded = (): void => {
    // Override in subclass if needed
  };

  private handleHLSError = (_event: string, data: ErrorData): void => {
    // Can be overridden to emit to state system
    console.error("HLS Error:", data);
  };

  // ==========================================================================
  // Playback Control Methods (using transitions)
  // ==========================================================================

  /**
   * Play the video using transition
   */
  play(): TE.TaskEither<PlaybackErrors.Any, PlayerState.Control.Playing> {
    return pipe(
      this.getState(),
      TE.flatMap((currentState) => {
        // Use transition function
        const result = Transitions.play(currentState as PlayerState.Playable);
        return pipe(
          result,
          E.fold(
            (error) => TE.left(new InitializationError(`Cannot play from state: ${error.fromState._tag}`, this, error)),
            (playingState) => TE.right(playingState),
          ),
        );
      }),
      // Apply to video element
      TE.tap((playingState) =>
        TE.tryCatch(
          async () => {
            if (!this.videoElement) {
              throw new Error("Video element not initialized");
            }
            await this.videoElement.play();
            return playingState;
          },
          (error): PlaybackErrors.Any => new InitializationError("Failed to play video", this, error),
        ),
      ),
    );
  }

  /**
   * Pause the video using transition
   */
  pause(): TE.TaskEither<PlaybackErrors.Any, PlayerState.Control.Paused> {
    return pipe(
      this.getState(),
      TE.flatMap((currentState) => {
        // Ensure we're playing
        if (currentState._tag !== "Control/Playing") {
          return TE.left(new InitializationError(`Cannot pause from state: ${currentState._tag}`, this));
        }

        // Use transition function
        const result = Transitions.pause(currentState);
        return pipe(
          result,
          E.fold(
            (error) => TE.left(new InitializationError(`Failed to pause: ${error.message}`, this, error)),
            (pausedState) => TE.right(pausedState),
          ),
        );
      }),
      // Apply to video element
      TE.tap((pausedState) =>
        TE.tryCatch(
          async () => {
            if (!this.videoElement) {
              throw new Error("Video element not initialized");
            }
            this.videoElement.pause();
            return pausedState;
          },
          (error): PlaybackErrors.Any => new InitializationError("Failed to pause video", this, error),
        ),
      ),
    );
  }

  /**
   * Seek to a specific time using transition
   */
  seek(params: Transitions.SeekParams): TE.TaskEither<PlaybackErrors.Any, PlayerState.Control.Seeking> {
    return pipe(
      // Use transition function
      Transitions.seek(params),
      TE.mapLeft(
        (transitionError) =>
          // Convert transition error to playback error
          new InitializationError(transitionError.message, this, transitionError),
      ),
      // Apply to video element
      TE.tap((seekingState) =>
        TE.tryCatch(
          async () => {
            if (!this.videoElement) {
              throw new Error("Video element not initialized");
            }
            this.videoElement.currentTime = seekingState.toTime;
            return seekingState;
          },
          (error): PlaybackErrors.Any => new InitializationError("Failed to seek video", this, error),
        ),
      ),
    );
  }

  /**
   * Set playback rate
   */
  setPlaybackRate(rate: number): TE.TaskEither<PlaybackErrors.Any, void> {
    return TE.tryCatch(
      async () => {
        if (!this.videoElement) {
          throw new Error("Video element not initialized");
        }
        this.videoElement.playbackRate = rate;
      },
      (error): PlaybackErrors.Any => new InitializationError("Failed to set playback rate", this, error),
    );
  }
}
