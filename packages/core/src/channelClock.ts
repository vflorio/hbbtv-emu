/**
 * The channel's clock: a simulated live broadcast.
 *
 * A broadcast does not start when the viewer tunes to it, nor when an application loads:
 * it is already on air. The emulator gives every channel one timeline, a function of the
 * real time, so that its video and its scheduled stream events are where they would be on
 * air, whichever page, tab or browser shows them, and after every navigation.
 *
 * Choice of the emulator: every channel's time starts at the Unix epoch. It needs no state,
 * and it is the same in every tab and every engine.
 */

/** When every channel's time starts, in ms since the Unix epoch. */
export const CHANNEL_EPOCH_MS = 0;

/** The channel's time at the real time `nowMs`, in ms. */
export const channelTimeMs = (nowMs: number): number => nowMs - CHANNEL_EPOCH_MS;

/**
 * Where a channel whose stream is a loop of `durationSeconds` is at the real time `nowMs`,
 * in seconds: the stream has been looping since the channel's time started. `null` for a
 * stream without a known, finite duration (a live one follows the real time on its own).
 */
export const livePosition = (nowMs: number, durationSeconds: number): number | null =>
  Number.isFinite(durationSeconds) && durationSeconds > 0 ? (channelTimeMs(nowMs) / 1000) % durationSeconds : null;
