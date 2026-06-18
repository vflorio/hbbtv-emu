import { match } from "ts-pattern";
import type { PlayerState } from "..";

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
    .with({ _tag: "Source/Native/ProgressiveLoading" }, () => true)
    .with({ _tag: "Source/HLS/ManifestLoading" }, () => true)
    .with({ _tag: "Source/HLS/SegmentLoading" }, () => true)
    .with({ _tag: "Source/DASH/MPDLoading" }, () => true)
    .with({ _tag: "Source/DASH/SegmentDownloading" }, () => true)
    .otherwise(() => false);

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
