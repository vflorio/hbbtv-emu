/**
 * Video/Broadcast State
 *
 * State for the video/broadcast embedded object.
 */

import * as t from "io-ts";
import { AVComponentStateCodec, SelectedComponentsStateCodec } from "../../av/component";
import { ChannelStateCodec } from "./channel";
import { ProgrammeStateCodec } from "./programme";

// ─────────────────────────────────────────────────────────────────────────────
// Broadcast Play State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Broadcast play state.
 * Maps to Broadcast.VideoBroadcast.PlayState enum.
 */
export const BroadcastPlayStateCodec = t.union([
  t.literal(0), // UNREALIZED
  t.literal(1), // CONNECTING
  t.literal(2), // PRESENTING
  t.literal(3), // STOPPED
]);

export type BroadcastPlayState = t.TypeOf<typeof BroadcastPlayStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Stream Event State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stream event state.
 */
export const StreamEventStateCodec = t.type({
  /** Target URL */
  targetURL: t.string,
  /** Event name */
  eventName: t.string,
  /** Event data (hex encoded) */
  data: t.string,
  /** Optional text representation */
  text: t.union([t.string, t.undefined]),
  /** Status: trigger or error */
  status: t.union([t.literal("trigger"), t.literal("error")]),
});

export type StreamEventState = t.TypeOf<typeof StreamEventStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Stream Event Listener State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stream event listener registration.
 */
export const StreamEventListenerStateCodec = t.type({
  /** Target URL pattern */
  targetURL: t.string,
  /** Event name to listen for */
  eventName: t.string,
});

export type StreamEventListenerState = t.TypeOf<typeof StreamEventListenerStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Video/Broadcast State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Video/Broadcast object state.
 *
 * Represents the complete state of a video/broadcast embedded object.
 */
export const VideoBroadcastStateCodec = t.partial({
  /** Current play state */
  playState: BroadcastPlayStateCodec,

  /** Currently tuned channel */
  currentChannel: ChannelStateCodec,

  /** Current EPG programmes for the channel */
  programmes: t.array(ProgrammeStateCodec),

  /** Available components (video, audio, subtitle tracks) */
  components: t.array(AVComponentStateCodec),

  /** Currently selected components (by component tag) */
  selectedComponents: SelectedComponentsStateCodec,

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

  /** Registered stream event listeners */
  streamEventListeners: t.array(StreamEventListenerStateCodec),
});

export type VideoBroadcastState = t.TypeOf<typeof VideoBroadcastStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Default Values
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_BROADCAST_PLAY_STATE: NonNullable<VideoBroadcastState["playState"]> = 0; // UNREALIZED

export const DEFAULT_PROGRAMMES: NonNullable<VideoBroadcastState["programmes"]> = [];

export const DEFAULT_COMPONENTS: NonNullable<VideoBroadcastState["components"]> = [];

export const DEFAULT_SELECTED_COMPONENTS: NonNullable<VideoBroadcastState["selectedComponents"]> = {};

export const DEFAULT_VOLUME: NonNullable<VideoBroadcastState["volume"]> = 100;

export const DEFAULT_MUTED: NonNullable<VideoBroadcastState["muted"]> = false;

export const DEFAULT_FULL_SCREEN: NonNullable<VideoBroadcastState["fullScreen"]> = false;

export const DEFAULT_VIDEO_WIDTH: NonNullable<VideoBroadcastState["width"]> = 1280;

export const DEFAULT_VIDEO_HEIGHT: NonNullable<VideoBroadcastState["height"]> = 720;

export const DEFAULT_STREAM_EVENT_LISTENERS: NonNullable<VideoBroadcastState["streamEventListeners"]> = [];

export const DEFAULT_VIDEO_BROADCAST: NonNullable<VideoBroadcastState> = {
  playState: DEFAULT_BROADCAST_PLAY_STATE,
  currentChannel: undefined,
  programmes: DEFAULT_PROGRAMMES,
  components: DEFAULT_COMPONENTS,
  selectedComponents: DEFAULT_SELECTED_COMPONENTS,
  volume: DEFAULT_VOLUME,
  muted: DEFAULT_MUTED,
  fullScreen: DEFAULT_FULL_SCREEN,
  width: DEFAULT_VIDEO_WIDTH,
  height: DEFAULT_VIDEO_HEIGHT,
  streamEventListeners: DEFAULT_STREAM_EVENT_LISTENERS,
};
