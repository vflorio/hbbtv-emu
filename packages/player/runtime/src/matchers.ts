/**
 * Pattern Matching Helpers
 */

import { match } from "ts-pattern";
import type { PlayerState, SourceMetadata } from "./states";

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
// State Category Predicates
// ============================================================================

/**
 * Type guard: Check if state is playable
 */
export const isPlayable = (state: PlayerState.Any): state is PlayerState.Playable => state._tagGroup === "Playable";

/**
 * Type guard: Check if state is an error
 */
export const isError = (state: PlayerState.Any): state is PlayerState.Errors => state.isError === true;

/**
 * Type guard: Check if error is recoverable
 */
export const isRecoverable = (state: PlayerState.Any): state is PlayerState.RecoverableErrors =>
  state._tagGroup === "RecoverableError";

/**
 * Type guard: Check if error is fatal
 */
export const isFatal = (state: PlayerState.Any): state is PlayerState.FatalErrors => state._tagGroup === "FatalError";

/**
 * Type guard: Check if state is a control state
 */
export const isControlState = (state: PlayerState.Any): state is PlayerState.Control.Any =>
  state._tag.startsWith("Control/");

/**
 * Type guard: Check if state is idle
 */
export const isIdle = (state: PlayerState.Any): boolean => state._tag === "Control/Idle";

/**
 * Type guard: Check if state is ended
 */
export const isEnded = (state: PlayerState.Any): boolean => state._tag === "Control/Ended";

/**
 * Type guard: Check if state is seeking
 */
export const isSeeking = (state: PlayerState.Any): boolean => state._tag === "Control/Seeking";

/**
 * Type guard: Check if state is buffering
 */
export const isBuffering = (state: PlayerState.Any): boolean => state._tag === "Control/Buffering";

/**
 * Type guard: Check if state is a source state
 */
export const isSourceState = (state: PlayerState.Any): state is PlayerState.Source.Any =>
  state._tag.startsWith("Source/");

/**
 * Type guard: Check if state is HLS-specific
 */
export const isHLSState = (state: PlayerState.Any): state is PlayerState.Source.HLS.Any =>
  state._tag.startsWith("Source/HLS/");

/**
 * Type guard: Check if state is DASH-specific
 */
export const isDASHState = (state: PlayerState.Any): state is PlayerState.Source.DASH.Any =>
  state._tag.startsWith("Source/DASH/");

/**
 * Type guard: Check if state is MP4-specific
 */
export const isNativeState = (state: PlayerState.Any): state is PlayerState.Source.Native.Any =>
  state._tag.startsWith("Source/Native/");

/**
 * Type guard: Check if state has time information
 */
export const hasTimeInfo = (
  state: PlayerState.Any,
): state is Extract<PlayerState.Any, { currentTime: number; duration: number }> =>
  "currentTime" in state && "duration" in state;

/**
 * Type guard: Check if state has buffered info
 */
export const hasBufferedInfo = (
  state: PlayerState.Any,
): state is Extract<PlayerState.Any, { buffered: readonly any[] }> => "buffered" in state;

// ============================================================================
// Common Pattern Matchers
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

/**
 * Check if state allows seeking
 */
export const canSeek = (state: PlayerState.Any): boolean =>
  match(state)
    .with({ _tag: "Control/Playing" }, () => true)
    .with({ _tag: "Control/Paused" }, () => true)
    .with({ _tag: "Control/Buffering" }, () => true)
    .otherwise(() => false);

/**
 * Check if state allows playback control
 */
export const canControl = (state: PlayerState.Any): boolean =>
  match(state)
    .with({ _tagGroup: "Playable" }, () => true)
    .otherwise(() => false);

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
 * Determine if player is actively playing
 */
export const isPlaying = (state: PlayerState.Any): boolean => state._tag === "Control/Playing";

/**
 * Determine if player is paused
 */
export const isPaused = (state: PlayerState.Any): boolean => state._tag === "Control/Paused";

/**
 * Determine if player is loading
 */
export const isLoading = (state: PlayerState.Any): boolean =>
  match(state)
    .with({ _tag: "Control/Loading" }, () => true)
    .with({ _tag: "Control/Buffering" }, () => true)
    .with({ _tag: "Source/HLS/ManifestLoading" }, () => true)
    .with({ _tag: "Source/HLS/SegmentLoading" }, () => true)
    .with({ _tag: "Source/DASH/MPDLoading" }, () => true)
    .with({ _tag: "Source/DASH/SegmentDownloading" }, () => true)
    .with({ _tag: "Source/Native/ProgressiveLoading" }, () => true)
    .otherwise(() => false);

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
// Format-Specific Matchers
// ============================================================================

/**
 * Match on HLS-specific states
 */
export const matchHLSState = <T>(state: PlayerState.Source.HLS.Any): Match<PlayerState.Source.HLS.Any, T> =>
  match<PlayerState.Source.HLS.Any, T>(state);

/**
 * Match on DASH-specific states
 */
export const matchDASHState = <T>(state: PlayerState.Source.DASH.Any): Match<PlayerState.Source.DASH.Any, T> =>
  match<PlayerState.Source.DASH.Any, T>(state);

/**
 * Match on MP4-specific states
 */
export const matchMP4State = <T>(state: PlayerState.Source.Native.Any): Match<PlayerState.Source.Native.Any, T> =>
  match<PlayerState.Source.Native.Any, T>(state);

/**
 * Get current quality information (works for HLS and DASH)
 */
export const getQualityInfo = (state: PlayerState.Any) =>
  match(state)
    .with({ _tag: "Source/HLS/VariantSelected" }, (s) => ({
      type: "hls" as const,
      bandwidth: s.bandwidth,
      resolution: s.resolution,
      variant: s.variant,
    }))
    .with({ _tag: "Source/DASH/RepresentationSelected" }, (s) => ({
      type: "dash" as const,
      bandwidth: s.bandwidth,
      resolution: s.resolution,
      representation: s.representation,
    }))
    .when(
      (s): s is Extract<PlayerState.Any, { source?: SourceMetadata }> => "source" in s && !!s.source,
      (s) => ({
        type: s.source!.playbackType,
        resolution: s.source!.resolution,
        codec: s.source!.codec,
      }),
    )
    .otherwise(() => null);

// ============================================================================
// Event Matching Utilities
// ============================================================================

/**
 * Match on runtime events (not PlayerState)
 *
 * @example
 * matchPlayerEvent(event)
 *   .with({ _tag: 'Engine/VolumeChanged' }, (e) => console.log('Volume:', e.volume))
 *   .with({ _tag: 'Adapter/Created' }, () => console.log('Adapter ready'))
 *   .otherwise(() => {});
 */
export const matchPlayerEvent = <T>(event: any): ReturnType<typeof match<any, T>> => match<any, T>(event);

/**
 * Type guard: Check if event is volume change
 */
export const isVolumeChangeEvent = (
  event: any,
): event is { _tag: "Engine/VolumeChanged"; volume: number; muted: boolean } => event?._tag === "Engine/VolumeChanged";

/**
 * Type guard: Check if event is adapter created
 */
export const isAdapterCreatedEvent = (event: any): event is { _tag: "Adapter/Created" } =>
  event?._tag === "Adapter/Created";

/**
 * Type guard: Check if event is adapter destroyed
 */
export const isAdapterDestroyedEvent = (event: any): event is { _tag: "Adapter/Destroyed" } =>
  event?._tag === "Adapter/Destroyed";

/**
 * Type guard: Check if event is metadata loaded
 */
export const isMetadataLoadedEvent = (event: any): event is { _tag: "Adapter/MetadataLoaded" } =>
  event?._tag === "Adapter/MetadataLoaded";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format time in MM:SS format
 */
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Format bandwidth in Mbps
 */
const formatBandwidth = (bps: number) => `${(bps / 1_000_000).toFixed(1)} Mbps`;

/**
 * Format bytes in a human-readable format
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
};
