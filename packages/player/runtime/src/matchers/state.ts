/**
 * Pattern Matching Utilities for Player State
 */

import { formatBandwidth, formatBytes, formatTime } from "@functional-player/core";
import { match } from "ts-pattern";
import type { PlayerState } from "../states";
import { hasBufferedInfo, hasTimeInfo, isError, isRecoverable } from "./predicates";

// ============================================================================
// Pattern Matching Utilities
// ============================================================================

type Match<S, T> = ReturnType<typeof match<S, T>>;

/**
 * Match on player state with exhaustive checking
 *
 * @example
 * const result = matchPlayerState(state)
 *   .with({ _tag: 'Control/Playing' }, (s) => `Playing at ${s.currentTime}`)
 *   .with({ _tag: 'Control/Paused' }, () => 'Paused')
 *   .with({ isError: true }, (s) => `Error: ${s.error.message}`)
 *   .otherwise(() => 'Unknown state');
 */
export const matchPlayerState = <T>(state: PlayerState.Any): Match<PlayerState.Any, T> =>
  match<PlayerState.Any, T>(state);

/**
 * Match specifically on playable states
 */
export const matchPlayableState = <T>(state: PlayerState.Playable): Match<PlayerState.Playable, T> =>
  match<PlayerState.Playable, T>(state);

/**
 * Match specifically on error states
 */
export const matchErrorState = <T>(state: PlayerState.Errors): Match<PlayerState.Errors, T> =>
  match<PlayerState.Errors, T>(state);

// ============================================================================
// State Accessors
// ============================================================================

/**
 * Get current playback time if available
 */
export const getCurrentTime = (state: PlayerState.Any): number | null =>
  hasTimeInfo(state) ? state.currentTime : null;

/**
 * Get duration if available
 */
export const getDuration = (state: PlayerState.Any): number | null =>
  "duration" in state && typeof state.duration === "number" ? state.duration : null;

/**
 * Get buffered ranges if available
 */
export const getBufferedRanges = (state: PlayerState.Any) => (hasBufferedInfo(state) ? state.buffered : []);

/**
 * Extract error from state if it's an error state
 */
export const getError = (state: PlayerState.Any): Error | null => (isError(state) ? state.error : null);

/**
 * Get retry count if state is a recoverable error
 */
export const getRetryCount = (state: PlayerState.Any): number | null =>
  isRecoverable(state) ? state.retryCount : null;

// ============================================================================
// State Description
// ============================================================================

/**
 * Get user-friendly state description
 */
export const getStateDescription = (state: PlayerState.Any): string =>
  match(state)
    .with({ _tag: "Control/Idle" }, () => "Ready to load media")
    .with({ _tag: "Control/Loading" }, (s) => `Loading: ${s.progress}%`)
    .with({ _tag: "Control/Playing" }, (s) => {
      const sourceInfo = s.source
        ? ` [${s.source.playbackType.toUpperCase()}${s.source.resolution ? ` ${s.source.resolution.width}x${s.source.resolution.height}` : ""}]`
        : "";
      return `Playing (${formatTime(s.currentTime)} / ${formatTime(s.duration)})${sourceInfo}`;
    })
    .with({ _tag: "Control/Paused" }, (s) => {
      const sourceInfo = s.source
        ? ` [${s.source.playbackType.toUpperCase()}${s.source.resolution ? ` ${s.source.resolution.width}x${s.source.resolution.height}` : ""}]`
        : "";
      return `Paused at ${formatTime(s.currentTime)}${sourceInfo}`;
    })
    .with({ _tag: "Control/Buffering" }, (s) => `Buffering ${s.bufferProgress}%`)
    .with({ _tag: "Control/Seeking" }, (s) => `Seeking to ${formatTime(s.toTime)}`)
    .with({ _tag: "Control/Ended" }, () => "Playback ended")

    // MP4 states
    .with(
      { _tag: "Source/Native/ProgressiveLoading" },
      (s) =>
        `Loading: ${formatBytes(s.bytesLoaded)} / ${s.bytesTotal > 0 ? formatBytes(s.bytesTotal) : "unknown"}${s.canPlayThrough ? " (can play)" : ""}`,
    )

    // HLS states
    .with({ _tag: "Source/HLS/ManifestLoading" }, () => "Loading HLS manifest")
    .with({ _tag: "Source/HLS/ManifestParsed" }, (s) => `HLS manifest parsed (${s.variants.length} variants)`)
    .with(
      { _tag: "Source/HLS/VariantSelected" },
      (s) => `HLS ${s.resolution.width}x${s.resolution.height} @ ${formatBandwidth(s.bandwidth)}`,
    )
    .with({ _tag: "Source/HLS/SegmentLoading" }, (s) => `Loading segment ${s.segmentIndex + 1}/${s.totalSegments}`)
    .with({ _tag: "Source/HLS/AdaptiveSwitching" }, (s) => `Switching quality (${s.reason})`)

    // DASH states
    .with({ _tag: "Source/DASH/MPDLoading" }, () => "Loading DASH MPD")
    .with({ _tag: "Source/DASH/MPDParsed" }, (s) => `MPD parsed (${s.adaptationSets.length} adaptation sets)`)
    .with(
      { _tag: "Source/DASH/RepresentationSelected" },
      (s) => `DASH ${s.resolution.width}x${s.resolution.height} @ ${formatBandwidth(s.bandwidth)}`,
    )
    .with({ _tag: "Source/DASH/SegmentDownloading" }, (s) => `Downloading ${s.mediaType} segment ${s.segmentIndex}`)
    .with({ _tag: "Source/DASH/QualitySwitching" }, (s) => `Switching quality (${s.reason})`)

    // Error states
    .with({ _tag: "Error/Network" }, (s) => `Network error: ${s.error.message}`)
    .with({ _tag: "Error/NotSupported" }, (s) => `Format not supported: ${s.mimeType}`)
    .with({ _tag: "Error/DRM" }, (s) => `DRM error (${s.keySystem}): ${s.error.message}`)
    .with({ _tag: "Error/Abort" }, (s) => `Aborted: ${s.reason}`)

    // Format-specific errors
    .with({ _tag: "Source/Native/DecodeError" }, (s) => `MP4 decode error: ${s.error.message}`)
    .with({ _tag: "Source/HLS/ManifestParseError" }, (s) => `HLS manifest error (retry ${s.retryCount})`)
    .with({ _tag: "Source/HLS/SegmentLoadError" }, (s) => `HLS segment error (retry ${s.retryCount})`)
    .with({ _tag: "Source/DASH/MPDParseError" }, (s) => `DASH MPD error (retry ${s.retryCount})`)
    .with({ _tag: "Source/DASH/SegmentDownloadError" }, (s) => `DASH segment error (retry ${s.retryCount})`)

    .exhaustive();
