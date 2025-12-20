/**
 * State Transition Functions
 */

import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import { type DASHRepresentation, type HLSVariant, PlayerState } from "./state";

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

export interface VariantSelectionParams {
  readonly variant: HLSVariant;
  readonly reason: "bandwidth" | "manual";
}

export interface RepresentationSelectionParams {
  readonly representation: DASHRepresentation;
  readonly reason: "abr" | "manual" | "constraint";
}

// ============================================================================
// Error Types for Transitions
// ============================================================================

export class TransitionError extends Error {
  constructor(
    message: string,
    readonly fromState: PlayerState.Any,
    readonly attemptedTransition: string,
  ) {
    super(message);
    this.name = "TransitionError";
  }
}

export class LoadError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly sourceType: string,
  ) {
    super(message);
    this.name = "LoadError";
  }
}

// ============================================================================
// State Transition Functions
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
                120, // duration
                { width: 1920, height: 1080 },
                "avc1.42E01E, mp4a.40.2",
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
): E.Either<never, PlayerState.Control.Playing | PlayerState.Control.Paused> =>
  E.right(
    shouldPlay
      ? new PlayerState.Control.Playing(seekingState.toTime, seekingState.duration, [], 1.0)
      : new PlayerState.Control.Paused(seekingState.toTime, seekingState.duration, []),
  );

/**
 * Handle buffering event during playback
 */
export const startBuffering = (
  playingState: PlayerState.Control.Playing,
): E.Either<never, PlayerState.Control.Buffering> =>
  E.right(
    new PlayerState.Control.Buffering(
      playingState.currentTime,
      playingState.duration,
      playingState.buffered,
      0, // Initial buffer progress
    ),
  );

/**
 * Resume from buffering
 */
export const resumeFromBuffering = (
  bufferingState: PlayerState.Control.Buffering,
): E.Either<never, PlayerState.Control.Playing> =>
  E.right(
    new PlayerState.Control.Playing(bufferingState.currentTime, bufferingState.duration, bufferingState.buffered, 1.0),
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
// HLS-Specific Transitions
// ============================================================================

/**
 * Parse HLS manifest
 */
export const parseHLSManifest = (
  manifestLoading: PlayerState.Source.HLS.ManifestLoading,
): TE.TaskEither<PlayerState.Source.HLS.ManifestParseError, PlayerState.Source.HLS.ManifestParsed> =>
  pipe(
    TE.tryCatch(
      async () => {
        // Simulate manifest parsing
        const variants: HLSVariant[] = [
          {
            bandwidth: 5000000,
            resolution: { width: 1920, height: 1080 },
            codecs: "avc1.42E01E, mp4a.40.2",
            url: `${manifestLoading.url}/variant-1080p.m3u8`,
          },
          {
            bandwidth: 2500000,
            resolution: { width: 1280, height: 720 },
            codecs: "avc1.42E01E, mp4a.40.2",
            url: `${manifestLoading.url}/variant-720p.m3u8`,
          },
        ];

        return new PlayerState.Source.HLS.ManifestParsed(
          manifestLoading.url,
          variants,
          120, // duration
        );
      },
      (error) =>
        new PlayerState.Source.HLS.ManifestParseError(
          error instanceof Error ? error : new Error(String(error)),
          0,
          manifestLoading.url,
        ),
    ),
  );

/**
 * Select HLS variant
 */
export const selectHLSVariant = (
  manifestParsed: PlayerState.Source.HLS.ManifestParsed,
  params: VariantSelectionParams,
): E.Either<Error, PlayerState.Source.HLS.VariantSelected> =>
  // Validate variant exists
  manifestParsed.variants.some((v) => v.url === params.variant.url)
    ? E.right(
        new PlayerState.Source.HLS.VariantSelected(params.variant, params.variant.bandwidth, params.variant.resolution),
      )
    : E.left(new Error("Variant not found in manifest"));

/**
 * Switch HLS variant (adaptive streaming)
 */
export const switchHLSVariant = (
  currentVariant: PlayerState.Source.HLS.VariantSelected,
  newVariant: HLSVariant,
  reason: "bandwidth" | "manual",
): E.Either<never, PlayerState.Source.HLS.AdaptiveSwitching> =>
  E.right(new PlayerState.Source.HLS.AdaptiveSwitching(currentVariant.variant, newVariant, reason));

// ============================================================================
// DASH-Specific Transitions
// ============================================================================

/**
 * Parse DASH MPD
 */
export const parseDASHMPD = (
  mpdLoading: PlayerState.Source.DASH.MPDLoading,
): TE.TaskEither<PlayerState.Source.DASH.MPDParseError, PlayerState.Source.DASH.MPDParsed> =>
  pipe(
    TE.tryCatch(
      async () => {
        // Simulate MPD parsing
        const adaptationSets = [
          {
            id: "video",
            contentType: "video" as const,
            mimeType: "video/mp4",
            representations: [
              {
                id: "video-1080p",
                bandwidth: 5000000,
                codecs: "avc1.42E01E",
                resolution: { width: 1920, height: 1080 },
              },
              {
                id: "video-720p",
                bandwidth: 2500000,
                codecs: "avc1.42E01E",
                resolution: { width: 1280, height: 720 },
              },
            ],
          },
        ];

        return new PlayerState.Source.DASH.MPDParsed(
          mpdLoading.url,
          adaptationSets,
          120, // duration
          false, // isDynamic
        );
      },
      (error) =>
        new PlayerState.Source.DASH.MPDParseError(
          error instanceof Error ? error : new Error(String(error)),
          0,
          mpdLoading.url,
        ),
    ),
  );

/**
 * Select DASH representation
 */
export const selectDASHRepresentation = (
  mpdParsed: PlayerState.Source.DASH.MPDParsed,
  params: RepresentationSelectionParams,
): E.Either<Error, PlayerState.Source.DASH.RepresentationSelected> =>
  // Validate representation exists
  mpdParsed.adaptationSets.some((set) => set.representations.some((r) => r.id === params.representation.id))
    ? E.right(
        new PlayerState.Source.DASH.RepresentationSelected(
          params.representation,
          params.representation.bandwidth,
          params.representation.resolution || { width: 0, height: 0 },
        ),
      )
    : E.left(new Error("Representation not found in MPD"));

/**
 * Switch DASH representation (quality switching)
 */
export const switchDASHRepresentation = (
  currentRepresentation: PlayerState.Source.DASH.RepresentationSelected,
  newRepresentation: DASHRepresentation,
  reason: "abr" | "manual" | "constraint",
): E.Either<never, PlayerState.Source.DASH.QualitySwitching> =>
  E.right(
    new PlayerState.Source.DASH.QualitySwitching(currentRepresentation.representation, newRepresentation, reason),
  );

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
