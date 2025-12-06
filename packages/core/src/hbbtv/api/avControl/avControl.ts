/**
 * A/V Control Object Interfaces
 *
 * The A/V Control object supports presentation of video and audio or just audio.
 * This is indicated by setting the type attribute to one of the "video/" or "audio/"
 * MIME types supported by the terminal.
 *
 * @see OIPF DAE V1.1 Clause 7.14
 * @see HbbTV 1.0 (ETSI TS 102 796 V1.1.1)
 * @see CEA-2014-A Section 5.7.1
 *
 * @since HbbTV 1.0
 */

import type { ErrorCode, PlayState } from "./constants";
import type {
  OnFullScreenChangeHandler,
  OnPlayPositionChangedHandler,
  OnPlaySpeedChangedHandler,
  OnPlayStateChangeHandler,
} from "./events";

/**
 * Base properties and methods for A/V Control objects.
 *
 * These properties and methods apply to both video and audio A/V Control objects.
 */
export interface AVControlBase {
  /**
   * Media URL.
   *
   * If the value of data is changed while media is playing, playback is stopped
   * (resulting in a play state change). The default value is the empty string.
   *
   * If the value is set to an empty string or changed, resources currently owned
   * by the object SHALL be released.
   *
   * The value MAY include a temporal fragment interval according to Media Fragments URI
   * section 4.2.1, in which case the begin and end times serve as bounds for playback.
   *
   * @default ""
   */
  data: string;

  /**
   * The play position in milliseconds since the beginning of the media.
   *
   * Position is in relation to NPT 0.0 as described in RFC 2326 section 3.6.
   * If the play position cannot be determined, the value SHALL be undefined.
   *
   * @readonly
   */
  readonly playPosition: number | undefined;

  /**
   * The estimated total duration in milliseconds of the media.
   *
   * If the duration cannot be determined, the value SHALL be undefined.
   *
   * @readonly
   */
  readonly playTime: number | undefined;

  /**
   * Indication of the current play state.
   *
   * @see PlayState
   * @readonly
   */
  readonly playState: PlayState;

  /**
   * Error details.
   *
   * Only significant if playState equals ERROR (6).
   * After an automatic transition from error to stopped state,
   * the value of error SHALL be preserved.
   *
   * @see ErrorCode
   * @readonly
   */
  readonly error: ErrorCode | undefined;

  /**
   * Play speed relative to real-time.
   *
   * 1 = normal speed, 2 = 2x speed, -1 = reverse, 0 = paused, etc.
   *
   * @readonly
   */
  readonly speed: number;

  /** DOM-0 event handler called when the value of playState changes. */
  onPlayStateChange: OnPlayStateChangeHandler | null;

  /** DOM-0 event handler called when play position changes due to random access. */
  onPlayPositionChanged: OnPlayPositionChangedHandler | null;

  /** DOM-0 event handler called when play speed changes. */
  onPlaySpeedChanged: OnPlaySpeedChangedHandler | null;

  /**
   * Plays the media referenced by data.
   *
   * Starts playback at the current play position at the supported speed closest
   * to the specified speed value. Negative speeds reverse playback.
   *
   * @param speed - Play speed relative to real-time (default: 1)
   * @returns true if the method succeeded
   */
  play(speed?: number): boolean;

  /**
   * Stops playback and resets playPosition to 0.
   *
   * Calling stop() SHALL cause any queued media item to be discarded.
   *
   * @returns true if the method succeeded
   */
  stop(): boolean;

  /**
   * Seeks to a new play position.
   *
   * @param pos - Target position in milliseconds
   * @returns true if the seek succeeded, false otherwise
   */
  seek(pos: number): boolean;

  /**
   * Sets the audio volume.
   *
   * @param volume - Volume level (0-100)
   * @returns true if the method succeeded
   */
  setVolume(volume: number): boolean;

  /**
   * Queue media for playback after the current item.
   *
   * @param url - Media URL to queue, or null to clear the queue
   * @returns true if the item was queued successfully
   * @since HbbTV A.2.5.1
   */
  queue(url: string | null): boolean;

  /**
   * Sets the source to downloaded or recorded content.
   *
   * @param id - The content identifier
   * @returns true if the source was set successfully
   */
  setSource(id: string): boolean;
}

/**
 * Additional properties and methods for video A/V Control objects.
 *
 * These properties and methods only apply when the type attribute refers to video.
 */
export interface AVControlVideo extends AVControlBase {
  /**
   * The width of the area used for rendering the video object.
   * This property is only writable if fullScreen is false.
   */
  width: string;

  /**
   * The height of the area used for rendering the video object.
   * This property is only writable if fullScreen is false.
   */
  height: string;

  /** Indicates whether the video is in full screen mode. @readonly */
  readonly fullScreen: boolean;

  /** DOM-0 event handler called when fullScreen value changes. */
  onFullScreenChange: OnFullScreenChangeHandler | null;

  /** DOM-0 event handler called when the object gains focus. */
  onfocus: (() => void) | null;

  /** DOM-0 event handler called when the object loses focus. */
  onblur: (() => void) | null;

  /**
   * Sets the object to full screen mode or windowed mode.
   * @param fullscreen - true for full screen, false for windowed
   */
  setFullScreen(fullscreen: boolean): void;

  /** Sets the input focus to this object. */
  focus(): void;
}

/**
 * A/V Control object for audio-only content.
 *
 * Audio objects do not have video-specific properties like fullScreen.
 */
export interface AVControlAudio extends AVControlBase {
  // Audio-only objects don't have additional properties beyond base
}

/**
 * Complete A/V Control object interface.
 *
 * Union type representing either a video or audio A/V Control object.
 */
export type AVControlObject = AVControlVideo | AVControlAudio;

// ============================================================================
// Subtitle Support (A.2.5.3)
// ============================================================================

/**
 * TTML Subtitle parameter for out-of-band subtitles.
 *
 * The `<object>` element of an A/V Control object shall contain a `<param>` element
 * for each subtitle component that is carried out-of-band.
 *
 * @example
 * ```html
 * <object type='video/mp4' data='http://example.com/video.mp4'>
 *   <param name='subtitles' value='srclang:de src:http%3A%2F%2Fexample.com%2Fsubs_de.ttml' />
 *   <param name='captions' value='srclang:en src:http%3A%2F%2Fexample.com%2Fsubs_en.ttml' />
 * </object>
 * ```
 *
 * @since HbbTV A.2.5.3
 */
export interface SubtitleParam {
  /**
   * Parameter name.
   * - "subtitles" for regular subtitles
   * - "captions" for hearing-impaired subtitles
   */
  name: "subtitles" | "captions";

  /** The language of the subtitles (xml:lang format). */
  srclang: string;

  /** The HTTP URL to the TTML document (percent-encoded). */
  src: string;

  /** A textual representation/label for the subtitle track. */
  label?: string;
}

/**
 * AVSubtitleComponent properties for TTML subtitles.
 *
 * @see OIPF DAE Clause 7.14.4.1
 * @since HbbTV A.2.5.3
 */
export interface AVSubtitleComponent {
  /**
   * Subtitle encoding.
   * For TTML subtitles, this SHALL be "application/ttml+xml".
   */
  readonly encoding: "application/ttml+xml";

  /** The subtitle language (from srclang key). */
  readonly language: string;

  /** true if the param name is 'captions', false otherwise. */
  readonly hearingImpaired: boolean;

  /** The label for the subtitle track. */
  readonly label: string;
}
