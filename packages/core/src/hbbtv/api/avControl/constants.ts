/**
 * A/V Control Object Constants
 *
 * Enumerations for play states, error codes, and MIME types
 * used by the A/V Control object.
 *
 * @see OIPF DAE V1.1 Clause 7.14
 * @see HbbTV Specification
 * @module hbbtv/api/avControl/constants
 */

/**
 * Play state values for the A/V Control object.
 *
 * Indicates the current playback state of the media.
 */
export enum PlayState {
  /**
   * Stopped - User (or script) has stopped playback of the current media,
   * or playback has not yet started.
   */
  STOPPED = 0,

  /**
   * Playing - The current media pointed to by data is currently playing.
   */
  PLAYING = 1,

  /**
   * Paused - The current media pointed to by data has been paused.
   */
  PAUSED = 2,

  /**
   * Connecting - Connect to media server, waiting for connection to be established.
   * DRM rights necessary for playback of protected content are also retrieved during this state.
   */
  CONNECTING = 3,

  /**
   * Buffering - The buffer is being filled to have sufficient data available.
   * Playback is stalled due to insufficient data. The player waits until sufficient
   * data has been buffered to continue playback. For video objects, the player
   * SHOULD show the last completed video frame.
   */
  BUFFERING = 4,

  /**
   * Finished - Playback of the current media has reached the end.
   */
  FINISHED = 5,

  /**
   * Error - An error occurred during media playback, preventing the media
   * from starting/continuing.
   */
  ERROR = 6,
}

/**
 * Error codes for the A/V Control object.
 *
 * These values are only significant when playState equals ERROR (6).
 * The error property shall be available in the stopped state.
 */
export enum ErrorCode {
  /** A/V format not supported */
  FORMAT_NOT_SUPPORTED = 0,

  /** Cannot connect to server or connection lost */
  CONNECTION_ERROR = 1,

  /** Unidentified error */
  UNIDENTIFIED = 2,

  /** Insufficient resources */
  INSUFFICIENT_RESOURCES = 3,

  /** Content corrupt or invalid */
  CONTENT_CORRUPT = 4,

  /** Content not available */
  CONTENT_NOT_AVAILABLE = 5,

  /** Content not available at given position */
  CONTENT_NOT_AVAILABLE_AT_POSITION = 6,

  /**
   * Content blocked due to parental control.
   * @since HbbTV A.2.5.1
   */
  PARENTAL_CONTROL_BLOCKED = 7,
}

// ============================================================================
// MIME Types
// ============================================================================

/**
 * Supported video MIME types for A/V Control objects.
 */
export type VideoMimeType =
  | "video/mp4"
  | "video/mpeg"
  | "video/webm"
  | "video/broadcast"
  | "application/dash+xml"
  | "application/vnd.apple.mpegurl";

/**
 * Supported audio MIME types for A/V Control objects.
 */
export type AudioMimeType = "audio/mp4" | "audio/mpeg" | "audio/aac" | "audio/webm";

/**
 * Supported subtitle MIME types.
 */
export type SubtitleMimeType = "application/ttml+xml" | "image/vnd.dvb.subtitle";

/**
 * All supported MIME types for A/V Control objects.
 */
export type AVControlMimeType = VideoMimeType | AudioMimeType;
