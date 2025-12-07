/**
 * A/V Control State
 *
 * State for A/V Control objects (video/mp4, video/dash, audio/*).
 *
 */

import * as t from "io-ts";
import { AVComponentStateCodec, SelectedComponentsStateCodec } from "./avComponent";

// ─────────────────────────────────────────────────────────────────────────────
// A/V Control Play State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A/V Control play state.
 * Maps to Control.PlayState enum.
 */
export const AVControlPlayStateCodec = t.union([
  t.literal(0), // STOPPED
  t.literal(1), // PLAYING
  t.literal(2), // PAUSED
  t.literal(3), // CONNECTING
  t.literal(4), // BUFFERING
  t.literal(5), // FINISHED
  t.literal(6), // ERROR
]);

export type AVControlPlayState = t.TypeOf<typeof AVControlPlayStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// A/V Control Error Codes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A/V Control error codes.
 */
export const AVControlErrorCodeCodec = t.union([
  t.literal(0), // MEDIA_ERR_UNKNOWN
  t.literal(1), // MEDIA_ERR_ABORTED
  t.literal(2), // MEDIA_ERR_NETWORK
  t.literal(3), // MEDIA_ERR_DECODE
  t.literal(4), // MEDIA_ERR_SRC_NOT_SUPPORTED
  t.literal(5), // MEDIA_ERR_ENCRYPTED
]);

export type AVControlErrorCode = t.TypeOf<typeof AVControlErrorCodeCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// A/V Control State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A/V Control object state.
 *
 * Represents the state of an A/V Control object (video/mp4, video/dash, audio/*).
 */
export const AVControlStateCodec = t.partial({
  /** MIME type (e.g., "video/mp4", "video/dash") */
  mimeType: t.string,

  /** Media source URL */
  data: t.string,

  /** Current play state */
  playState: AVControlPlayStateCodec,

  /** Error code (if playState is ERROR) */
  error: AVControlErrorCodeCodec,

  /** Current playback position in milliseconds */
  playPosition: t.number,

  /** Total media duration in milliseconds */
  playTime: t.number,

  /** Current playback speed (1.0 = normal) */
  speed: t.number,

  /** Volume level (0-100) */
  volume: t.number,

  /** Muted state */
  muted: t.boolean,

  /** Full screen state */
  fullScreen: t.boolean,

  /** Width in pixels */
  width: t.number,

  /** Height in pixels */
  height: t.number,

  /** Available components */
  components: t.array(AVComponentStateCodec),

  /** Selected components */
  selectedComponents: SelectedComponentsStateCodec,
});

export type AVControlState = t.TypeOf<typeof AVControlStateCodec>;
