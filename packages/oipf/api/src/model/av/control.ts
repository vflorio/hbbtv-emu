/**
 * A/V Control State
 *
 * State for A/V Control objects (video/mp4, video/dash, audio/*).
 *
 */

import * as t from "io-ts";
import { ErrorCode, PlayState } from "../../specification/av/control/control";
import { enumCodec } from "../enumCodec";
import { AVComponentStateCodec, SelectedComponentsStateCodec } from "./component";

// ─────────────────────────────────────────────────────────────────────────────
// A/V Control Play State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A/V Control play state.
 * Maps to Control.PlayState enum.
 */
export const AVControlPlayStateCodec = enumCodec<PlayState>("PlayState", PlayState);

export type AVControlPlayState = t.TypeOf<typeof AVControlPlayStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// A/V Control Error Codes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A/V Control error codes.
 */
export const AVControlErrorCodeCodec = enumCodec<ErrorCode>("ErrorCode", ErrorCode);

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

// ─────────────────────────────────────────────────────────────────────────────
// A/V Control Mime Type & utils
// ─────────────────────────────────────────────────────────────────────────────

export const AV_CONTROL_VIDEO_MP4_MIME_TYPE = "video/mp4";
export const AV_CONTROL_DASH_MIME_TYPE = "application/dash+xml";
export const AV_CONTROL_HLS_MIME_TYPE = "application/vnd.apple.mpegurl";
/** MP3, or HE-AAC in a transport stream (TS 102 796 Table 9). */
export const AV_CONTROL_AUDIO_MPEG_MIME_TYPE = "audio/mpeg";
/** HE-AAC in MP4 (TS 102 796 Table 9), also the format of audio from memory (OIPF DAE §7.14.10). */
export const AV_CONTROL_AUDIO_MP4_MIME_TYPE = "audio/mp4";

/**
 * The types an A/V Control object is bound for: those of TS 102 796 Table 9 and
 * MPEG-DASH, as the browser can play them, plus HLS (the emulator's own). Not
 * `video/mpeg`: no browser plays a transport stream (deprecated in HbbTV anyway).
 */
export const AV_CONTROL_MIME_TYPES: ReadonlyArray<string> = [
  AV_CONTROL_VIDEO_MP4_MIME_TYPE,
  AV_CONTROL_AUDIO_MPEG_MIME_TYPE,
  AV_CONTROL_AUDIO_MP4_MIME_TYPE,
  AV_CONTROL_DASH_MIME_TYPE,
  AV_CONTROL_HLS_MIME_TYPE,
];

/** An `<object>` whose type makes it an A/V Control object. */
export const isValidAvControl = (element: Element | null | undefined): element is HTMLObjectElement =>
  element instanceof HTMLObjectElement && AV_CONTROL_MIME_TYPES.includes(element.type);

export const isValidAvControlVideoMp4 = (element: Element | null | undefined): element is HTMLObjectElement =>
  element instanceof HTMLObjectElement && element.type === AV_CONTROL_VIDEO_MP4_MIME_TYPE;

export const isValidAvControlDash = (element: Element | null | undefined): element is HTMLObjectElement =>
  element instanceof HTMLObjectElement && element.type === AV_CONTROL_DASH_MIME_TYPE;

export const isValidAvControlHls = (element: Element | null | undefined): element is HTMLObjectElement =>
  element instanceof HTMLObjectElement && element.type === AV_CONTROL_HLS_MIME_TYPE;

// ─────────────────────────────────────────────────────────────────────────────
// Default Values
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_AV_CONTROL_PLAY_STATE: NonNullable<AVControlState["playState"]> = 0; // STOPPED

export const DEFAULT_AV_CONTROL_DATA: NonNullable<AVControlState["data"]> = "";

export const DEFAULT_AV_CONTROL_SPEED: NonNullable<AVControlState["speed"]> = 1;

export const DEFAULT_AV_CONTROL_VOLUME: NonNullable<AVControlState["volume"]> = 100;

export const DEFAULT_AV_CONTROL_MUTED: NonNullable<AVControlState["muted"]> = false;

export const DEFAULT_AV_CONTROL_FULL_SCREEN: NonNullable<AVControlState["fullScreen"]> = false;

export const DEFAULT_AV_CONTROL_WIDTH: NonNullable<AVControlState["width"]> = 0;

export const DEFAULT_AV_CONTROL_HEIGHT: NonNullable<AVControlState["height"]> = 0;

export const DEFAULT_AV_CONTROL_COMPONENTS: NonNullable<AVControlState["components"]> = [];

export const DEFAULT_AV_CONTROL_SELECTED_COMPONENTS: NonNullable<AVControlState["selectedComponents"]> = {};

export const DEFAULT_AV_CONTROL: NonNullable<AVControlState> = {
  data: DEFAULT_AV_CONTROL_DATA,
  playState: DEFAULT_AV_CONTROL_PLAY_STATE,
  speed: DEFAULT_AV_CONTROL_SPEED,
  volume: DEFAULT_AV_CONTROL_VOLUME,
  muted: DEFAULT_AV_CONTROL_MUTED,
  fullScreen: DEFAULT_AV_CONTROL_FULL_SCREEN,
  width: DEFAULT_AV_CONTROL_WIDTH,
  height: DEFAULT_AV_CONTROL_HEIGHT,
  components: DEFAULT_AV_CONTROL_COMPONENTS,
  selectedComponents: DEFAULT_AV_CONTROL_SELECTED_COMPONENTS,
};
