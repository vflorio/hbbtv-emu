/**
 * Core Transition Functions
 *
 * Common playback control transitions (play, pause, seek, etc)
 */

import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import { PlayerState, type Resolution, type TimeRange } from "../state";
import { TransitionError } from "./errors";

// ============================================================================
// Transition Context Types
// ============================================================================

export interface LoadSourceParams {
  readonly url: string;
  readonly sourceType: "mp4" | "hls" | "dash";
  readonly autoplay?: boolean;
}

export interface SeekParams {
  readonly targetTime: number;
  readonly currentState: PlayerState.Any;
}

export interface PlaybackParams {
  readonly playbackRate?: number;
}

export interface CompleteLoadingOptions {
  readonly mp4?: {
    readonly duration?: number;
    readonly resolution?: Resolution;
    readonly codec?: string;
  };
}

export interface CompleteSeekOptions {
  readonly buffered?: TimeRange[];
  readonly playbackRate?: number;
}

export interface BufferingOptions {
  readonly buffered?: TimeRange[];
  readonly bufferProgress?: number;
  readonly playbackRate?: number;
}

// ============================================================================
// Core State Transition Functions
// ============================================================================

/**
 * Load a media source
 */
export const loadSource = (
  params: LoadSourceParams,
): TE.TaskEither<PlayerState.Error.Any, PlayerState.Control.Loading> =>
  pipe(
    TE.tryCatch(
      async () => {
        // Validate URL
        new URL(params.url);

        // Return loading state
        return new PlayerState.Control.Loading(params.url, 0);
      },
      (error) =>
        new PlayerState.Error.NetworkError(error instanceof Error ? error : new Error(String(error)), 0, params.url),
    ),
  );

/**
 * Transition from Loading to format-specific ready state
 */
export const completeLoading = (
  loadingState: PlayerState.Control.Loading,
  sourceType: "mp4" | "hls" | "dash",
  options?: CompleteLoadingOptions,
): TE.TaskEither<PlayerState.Error.Any, PlayerState.Source.Any> =>
  pipe(
    TE.tryCatch(
      async () =>
        match(sourceType)
          .with(
            "mp4",
            () =>
              // Simulate MP4 metadata loading
              new PlayerState.Source.MP4.Ready(
                loadingState.url,
                options?.mp4?.duration ?? 120,
                options?.mp4?.resolution ?? { width: 1920, height: 1080 },
                options?.mp4?.codec ?? "avc1.42E01E, mp4a.40.2",
              ),
          )
          .with(
            "hls",
            () =>
              // Simulate HLS manifest loading
              new PlayerState.Source.HLS.ManifestLoading(loadingState.url),
          )
          .with(
            "dash",
            () =>
              // Simulate DASH MPD loading
              new PlayerState.Source.DASH.MPDLoading(loadingState.url),
          )
          .otherwise(() => {
            throw new Error(`Unsupported source type: ${sourceType}`);
          }),
      (error) =>
        new PlayerState.Error.NetworkError(
          error instanceof Error ? error : new Error(String(error)),
          0,
          loadingState.url,
        ),
    ),
  );

/**
 * Start playback from a playable state
 */
export const play = (currentState: PlayerState.Playable): E.Either<TransitionError, PlayerState.Control.Playing> =>
  match(currentState)
    .with({ _tag: "Control/Paused" }, (s) =>
      E.right(new PlayerState.Control.Playing(s.currentTime, s.duration, s.buffered, 1.0)),
    )
    .with({ _tag: "Control/Buffering" }, (s) =>
      E.right(new PlayerState.Control.Playing(s.currentTime, s.duration, s.buffered, 1.0)),
    )
    .with({ _tag: "Control/Ended" }, (s) =>
      // Restart from beginning
      E.right(new PlayerState.Control.Playing(0, s.duration, [], 1.0)),
    )
    .otherwise((s) => E.left(new TransitionError(`Cannot play from state: ${s._tag}`, s, "play")));

/**
 * Pause playback
 */
export const pause = (
  currentState: PlayerState.Control.Playing,
): E.Either<TransitionError, PlayerState.Control.Paused> =>
  E.right(new PlayerState.Control.Paused(currentState.currentTime, currentState.duration, currentState.buffered));

/**
 * Seek to a specific time
 */
export const seek = (params: SeekParams): TE.TaskEither<TransitionError, PlayerState.Control.Seeking> =>
  pipe(
    TE.tryCatch(
      async () => {
        const { targetTime, currentState } = params;

        // Validate we're in a seekable state
        if (!("currentTime" in currentState && "duration" in currentState)) {
          throw new TransitionError(`Cannot seek from state: ${currentState._tag}`, currentState, "seek");
        }

        // Validate target time
        if (targetTime < 0 || targetTime > currentState.duration) {
          throw new TransitionError(`Invalid seek time: ${targetTime}`, currentState, "seek");
        }

        return new PlayerState.Control.Seeking(currentState.currentTime, targetTime, currentState.duration);
      },
      (error) =>
        error instanceof TransitionError ? error : new TransitionError(String(error), params.currentState, "seek"),
    ),
  );

/**
 * Complete seeking and transition to playing or paused
 */
export const completeSeek = (
  seekingState: PlayerState.Control.Seeking,
  shouldPlay: boolean,
  options?: CompleteSeekOptions,
): E.Either<never, PlayerState.Control.Playing | PlayerState.Control.Paused> =>
  E.right(
    shouldPlay
      ? new PlayerState.Control.Playing(
          seekingState.toTime,
          seekingState.duration,
          options?.buffered ?? [],
          options?.playbackRate ?? 1.0,
        )
      : new PlayerState.Control.Paused(seekingState.toTime, seekingState.duration, options?.buffered ?? []),
  );

/**
 * Handle buffering event during playback
 */
export const startBuffering = (
  playingState: PlayerState.Control.Playing,
  options?: BufferingOptions,
): E.Either<never, PlayerState.Control.Buffering> =>
  E.right(
    new PlayerState.Control.Buffering(
      playingState.currentTime,
      playingState.duration,
      options?.buffered ?? playingState.buffered,
      options?.bufferProgress ?? 0,
    ),
  );

/**
 * Resume from buffering
 */
export const resumeFromBuffering = (
  bufferingState: PlayerState.Control.Buffering,
  options?: BufferingOptions,
): E.Either<never, PlayerState.Control.Playing> =>
  E.right(
    new PlayerState.Control.Playing(
      bufferingState.currentTime,
      bufferingState.duration,
      options?.buffered ?? bufferingState.buffered,
      options?.playbackRate ?? 1.0,
    ),
  );

/**
 * End playback
 */
export const end = (
  playingState: PlayerState.Control.Playing,
  wasLooping = false,
): E.Either<never, PlayerState.Control.Ended> =>
  E.right(new PlayerState.Control.Ended(playingState.duration, wasLooping));

// ============================================================================
// Error Recovery
// ============================================================================

/**
 * Retry a recoverable error
 */
export const retry = <T extends PlayerState.RecoverableErrors>(errorState: T, maxRetries = 3): E.Either<T, "retry"> =>
  errorState.retryCount >= maxRetries ? E.left(errorState) : E.right("retry");

/**
 * Reset to idle state (recovery from any error)
 */
export const reset = (_currentState: PlayerState.Any): E.Either<never, PlayerState.Control.Idle> =>
  E.right(new PlayerState.Control.Idle());
