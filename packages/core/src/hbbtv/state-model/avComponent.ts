/**
 * A/V Component State
 *
 * State for audio, video, and subtitle components in streams.
 *
 */

import * as t from "io-ts";

// ─────────────────────────────────────────────────────────────────────────────
// Component Type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Component type.
 */
export const ComponentTypeCodec = t.union([
  t.literal(0), // VIDEO
  t.literal(1), // AUDIO
  t.literal(2), // SUBTITLE
]);

export type ComponentTypeState = t.TypeOf<typeof ComponentTypeCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Audio Type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Audio component type.
 */
export const AudioTypeCodec = t.union([
  t.literal(0), // NORMAL
  t.literal(1), // AUDIO_DESCRIPTION
  t.literal(2), // CLEAN_AUDIO
  t.literal(3), // SPOKEN_SUBTITLES
]);

export type AudioTypeState = t.TypeOf<typeof AudioTypeCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Base Component State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base A/V component state.
 */
export const AVComponentBaseStateCodec = t.intersection([
  t.type({
    /** Component type (VIDEO, AUDIO, SUBTITLE) */
    componentType: ComponentTypeCodec,
    /** Component tag (PID) */
    componentTag: t.number,
  }),
  t.partial({
    /** Packet Identifier */
    pid: t.number,
    /** Encoding/codec (e.g., "video/h264") */
    encoding: t.string,
    /** Is encrypted */
    encrypted: t.boolean,
  }),
]);

export type AVComponentBaseState = t.TypeOf<typeof AVComponentBaseStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Audio Component State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Audio component state.
 */
export const AVAudioComponentStateCodec = t.intersection([
  AVComponentBaseStateCodec,
  t.partial({
    /** ISO 639-2 language code */
    language: t.string,
    /** Hearing impaired features */
    hearingImpaired: t.boolean,
    /** Audio type */
    audioType: AudioTypeCodec,
    /** Number of channels (stereo, 5.1, etc.) */
    audioChannels: t.number,
  }),
]);

export type AVAudioComponentState = t.TypeOf<typeof AVAudioComponentStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Video Component State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Video component state.
 */
export const AVVideoComponentStateCodec = t.intersection([
  AVComponentBaseStateCodec,
  t.partial({
    /** Video width in pixels */
    width: t.number,
    /** Video height in pixels */
    height: t.number,
    /** Frame rate */
    frameRate: t.number,
    /** Aspect ratio (e.g., "16:9") */
    aspectRatio: t.string,
  }),
]);

export type AVVideoComponentState = t.TypeOf<typeof AVVideoComponentStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Subtitle Component State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subtitle component state.
 */
export const AVSubtitleComponentStateCodec = t.intersection([
  AVComponentBaseStateCodec,
  t.partial({
    /** ISO 639-2 language code */
    language: t.string,
    /** Hearing impaired features */
    hearingImpaired: t.boolean,
    /** Subtitle format type */
    subtitleType: t.string,
  }),
]);

export type AVSubtitleComponentState = t.TypeOf<typeof AVSubtitleComponentStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Component Union
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Union of all component types.
 */
export const AVComponentStateCodec = t.union([
  AVAudioComponentStateCodec,
  AVVideoComponentStateCodec,
  AVSubtitleComponentStateCodec,
]);

export type AVComponentState = t.TypeOf<typeof AVComponentStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Selected Components State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Currently selected components (by component tag).
 */
export const SelectedComponentsStateCodec = t.partial({
  video: t.number,
  audio: t.number,
  subtitle: t.union([t.number, t.null]),
});

export type SelectedComponentsState = t.TypeOf<typeof SelectedComponentsStateCodec>;
