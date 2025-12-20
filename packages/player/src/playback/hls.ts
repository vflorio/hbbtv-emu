/**
 * HLS Playback
 *
 * Playback engine using hls.js for HLS (HTTP Live Streaming) support
 */

import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import Hls, { type ErrorData, Events } from "hls.js";
import { PlayerState } from "../state";
import { BasePlayback } from "./base";
import { EngineNotSupportedError, InitializationError, LoadError, PlaybackError, type PlaybackErrors } from "./errors";
import type { HLSConfig, QualityLevel } from "./types";

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
}
