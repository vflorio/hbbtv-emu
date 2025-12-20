/**
 * Native HTML5 Playback
 *
 * Playback engine using native HTML5 video element for MP4/WebM/Ogg
 */

import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { PlayerState, type TimeRange } from "../state";
import { BasePlayback } from "./base";
import { InitializationError, LoadError, type PlaybackErrors } from "./errors";
import type { NativeConfig } from "./types";

// ============================================================================
// Native Playback Implementation
// ============================================================================

export class NativePlayback extends BasePlayback<NativeConfig, HTMLVideoElement> {
  readonly _tag = "native" as const;
  readonly name = "Native HTML5";

  // ==========================================================================
  // Engine Creation
  // ==========================================================================

  protected createEngine(): TE.TaskEither<PlaybackErrors.Any, HTMLVideoElement> {
    // For native, the video element IS the engine
    return this.videoElement
      ? TE.right(this.videoElement)
      : TE.left(new InitializationError("Video element not set before createEngine", this));
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  initialize(videoElement: HTMLVideoElement): TE.TaskEither<PlaybackErrors.Any, void> {
    return pipe(
      TE.tryCatch(
        async () => {
          // Store references
          this.videoElement = videoElement;
          this.engine = videoElement;

          // Apply configuration
          if (this.config.preload) {
            videoElement.preload = this.config.preload;
          }
          if (this.config.crossOrigin) {
            videoElement.crossOrigin = this.config.crossOrigin;
          }
          if (this.config.autoplay !== undefined) {
            videoElement.autoplay = this.config.autoplay;
          }

          // Set source
          videoElement.src = this.source;

          // Setup event listeners
          this.setupNativeEvents(videoElement);
        },
        (error) => new InitializationError("Failed to initialize native playback", this, error),
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
          this.engine.load();
        },
        (error) => new LoadError("Failed to load native source", this.source, this, error),
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
          if (!this.engine) {
            return new PlayerState.Control.Idle();
          }

          const video = this.engine;

          // Get buffered ranges
          const buffered: TimeRange[] = [];
          for (let i = 0; i < video.buffered.length; i++) {
            buffered.push({
              start: video.buffered.start(i),
              end: video.buffered.end(i),
            });
          }

          // Determine state based on video element properties
          if (video.ended) {
            return new PlayerState.Control.Ended(video.duration, video.loop);
          }

          if (video.seeking) {
            return new PlayerState.Control.Seeking(
              video.currentTime,
              video.currentTime, // Target time not directly available
              video.duration,
            );
          }

          if (video.readyState < 3 && !video.paused) {
            // HAVE_FUTURE_DATA or less while trying to play
            return new PlayerState.Control.Buffering(
              video.currentTime,
              video.duration,
              buffered,
              Math.round((video.buffered.length > 0 ? video.buffered.end(0) / video.duration : 0) * 100),
            );
          }

          if (!video.paused) {
            return new PlayerState.Control.Playing(video.currentTime, video.duration, buffered, video.playbackRate);
          }

          if (video.paused && video.currentTime > 0) {
            return new PlayerState.Control.Paused(video.currentTime, video.duration, buffered);
          }

          // Ready but not started
          return new PlayerState.Source.MP4.Ready(
            this.source,
            video.duration || 0,
            {
              width: video.videoWidth,
              height: video.videoHeight,
            },
            "unknown", // Codec info not easily available
          );
        },
        (error): PlaybackErrors.Any => new InitializationError("Failed to get playback state", this, error),
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
          // Remove event listeners
          this.removeNativeEvents(this.engine);

          // Clear source
          this.engine.removeAttribute("src");
          this.engine.load(); // Reset

          this.engine = null;
          this.videoElement = null;
        }
      }),
      TE.map(() => undefined),
    );
  }

  // ==========================================================================
  // Event Management
  // ==========================================================================

  private setupNativeEvents(video: HTMLVideoElement): void {
    // Core playback events
    video.addEventListener("loadstart", this.handleLoadStart);
    video.addEventListener("loadedmetadata", this.handleLoadedMetadata);
    video.addEventListener("loadeddata", this.handleLoadedData);
    video.addEventListener("canplay", this.handleCanPlay);
    video.addEventListener("canplaythrough", this.handleCanPlayThrough);
    video.addEventListener("playing", this.handlePlaying);
    video.addEventListener("pause", this.handlePause);
    video.addEventListener("ended", this.handleEnded);
    video.addEventListener("seeking", this.handleSeeking);
    video.addEventListener("seeked", this.handleSeeked);
    video.addEventListener("waiting", this.handleWaiting);
    video.addEventListener("error", this.handleError);
  }

  private removeNativeEvents(video: HTMLVideoElement): void {
    video.removeEventListener("loadstart", this.handleLoadStart);
    video.removeEventListener("loadedmetadata", this.handleLoadedMetadata);
    video.removeEventListener("loadeddata", this.handleLoadedData);
    video.removeEventListener("canplay", this.handleCanPlay);
    video.removeEventListener("canplaythrough", this.handleCanPlayThrough);
    video.removeEventListener("playing", this.handlePlaying);
    video.removeEventListener("pause", this.handlePause);
    video.removeEventListener("ended", this.handleEnded);
    video.removeEventListener("seeking", this.handleSeeking);
    video.removeEventListener("seeked", this.handleSeeked);
    video.removeEventListener("waiting", this.handleWaiting);
    video.removeEventListener("error", this.handleError);
  }

  // Event handlers (can be overridden or extended)
  private handleLoadStart = (_event: Event): void => {
    // Override in subclass if needed
  };

  private handleLoadedMetadata = (_event: Event): void => {
    // Override in subclass if needed
  };

  private handleLoadedData = (_event: Event): void => {
    // Override in subclass if needed
  };

  private handleCanPlay = (_event: Event): void => {
    // Override in subclass if needed
  };

  private handleCanPlayThrough = (_event: Event): void => {
    // Override in subclass if needed
  };

  private handlePlaying = (_event: Event): void => {
    // Override in subclass if needed
  };

  private handlePause = (_event: Event): void => {
    // Override in subclass if needed
  };

  private handleEnded = (_event: Event): void => {
    // Override in subclass if needed
  };

  private handleSeeking = (_event: Event): void => {
    // Override in subclass if needed
  };

  private handleSeeked = (_event: Event): void => {
    // Override in subclass if needed
  };

  private handleWaiting = (_event: Event): void => {
    // Override in subclass if needed
  };

  private handleError = (_event: Event): void => {
    // Override in subclass if needed
  };
}
