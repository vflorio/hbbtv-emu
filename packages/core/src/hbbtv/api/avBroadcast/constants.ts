/**
 * HbbTV Video/Broadcast Constants
 *
 * Enumerations for play states, component types, error codes, and other
 * constants used by the video/broadcast embedded object.
 *
 * @see OIPF DAE Specification
 * @see HbbTV Specification
 */
/**
 * Play state values for the video/broadcast object.
 *
 * The video/broadcast object transitions between these states based on
 * application actions, terminal events, and error conditions.
 */
export enum PlayState {
  /**
   * Unrealized state.
   *
   * The application has not made a request to start presenting a channel
   * or has stopped presenting a channel and released any resources.
   *
   * The content of the video/broadcast object should be transparent but
   * if not it will be an opaque black rectangle.
   *
   * Control of media presentation is under the control of the terminal.
   */
  UNREALIZED = 0,

  /**
   * Connecting state.
   *
   * The terminal is connecting to the media source in order to begin playback.
   * Objects in this state may be buffering data in order to start playback.
   *
   * Control of media presentation is under the control of the application.
   * The content of the video/broadcast object is implementation dependent.
   */
  CONNECTING = 1,

  /**
   * Presenting state.
   *
   * The media is currently being presented to the user. The object is in this
   * state regardless of whether the media is playing at normal speed, paused,
   * or playing in a trick mode (e.g. at a speed other than normal speed).
   *
   * Control of media presentation is under the control of the application.
   * The video/broadcast object contains the video being presented.
   */
  PRESENTING = 2,

  /**
   * Stopped state.
   *
   * The terminal is not presenting media, either inside the video/broadcast
   * object or in the logical video plane. The logical video plane is disabled.
   *
   * The content of the video/broadcast object will be an opaque black rectangle.
   * Control of media presentation is under the control of the application.
   */
  STOPPED = 3,
}

/**
 * Component type constants for identifying media component types.
 *
 * These constants are used with methods like `getComponents()`,
 * `selectComponent()`, and `unselectComponent()`.
 */
export enum ComponentType {
  /**
   * Represents a video component.
   * Used for all video components regardless of encoding.
   */
  VIDEO = 0,

  /**
   * Represents an audio component.
   * Used for all audio components regardless of encoding.
   */
  AUDIO = 1,

  /**
   * Represents a subtitle component.
   * Used for all subtitle components regardless of subtitle format.
   *
   * @note A subtitle component may also be related to closed captioning
   * as part of a video stream.
   */
  SUBTITLE = 2,
}

/**
 * Error codes for channel change operations.
 *
 * These codes are passed to `onChannelChangeError` and indicate
 * the reason why a channel change operation failed.
 */
export enum ChannelChangeErrorCode {
  /** Channel not supported by tuner. */
  CHANNEL_NOT_SUPPORTED = 0,

  /** Cannot tune to given transport stream (e.g. no signal). */
  CANNOT_TUNE = 1,

  /** Tuner locked by other object. */
  TUNER_LOCKED = 2,

  /** Parental lock on channel. */
  PARENTAL_LOCK = 3,

  /** Encrypted channel, key/module missing. */
  ENCRYPTED_NO_KEY = 4,

  /** Unknown channel (e.g. can't resolve DVB triplet). */
  UNKNOWN_CHANNEL = 5,

  /** Channel switch interrupted (e.g. another channel switch was activated). */
  SWITCH_INTERRUPTED = 6,

  /** Channel cannot be changed because it is currently being recorded. */
  RECORDING_IN_PROGRESS = 7,

  /** Cannot resolve URI of referenced IP channel. */
  CANNOT_RESOLVE_URI = 8,

  /** Insufficient bandwidth. */
  INSUFFICIENT_BANDWIDTH = 9,

  /**
   * Channel cannot be changed by nextChannel()/prevChannel() methods.
   *
   * Either because the terminal does not maintain a favourites or channel list
   * or because the video/broadcast object is in the Unrealized state.
   */
  NO_CHANNEL_LIST = 10,

  /**
   * Insufficient resources are available to present the given channel.
   * (e.g. a lack of available codec resources).
   */
  INSUFFICIENT_RESOURCES = 11,

  /** Specified channel not found in transport stream. */
  CHANNEL_NOT_IN_TS = 12,

  /** Unidentified error. */
  UNIDENTIFIED_ERROR = 100,
}

/**
 * DRM rights error states for `onDRMRightsError` callback.
 *
 * @note Only supported on terminals that support CI Plus.
 */
export enum DRMRightsErrorState {
  /** No license, consumption of the content is blocked. */
  NO_LICENSE = 0,

  /** Invalid license, consumption of the content is blocked. */
  INVALID_LICENSE = 1,

  /** Valid license, consumption of the content is unblocked. */
  VALID_LICENSE = 2,
}

/**
 * Quiet mode values for `setChannel()` method.
 *
 * Controls how the terminal presents channel change information to the user.
 */
export enum QuietMode {
  /**
   * Normal channel change.
   *
   * The viewer experience is exactly as if they had initiated a standard
   * channel change operation using the terminal's inherent channel navigation
   * mechanisms (e.g. Ch+ or Ch- keys or numeric entry).
   */
  NORMAL = 0,

  /**
   * Normal channel change with no UI displayed.
   *
   * The terminal executes the channel change operation but does not present
   * any channel banner that is usually displayed by the terminal.
   */
  NO_BANNER = 1,

  /**
   * Quiet channel change.
   *
   * The terminal suppresses the presentation of all information usually
   * presented during a channel change operation. The channel selected by
   * the last normal channel change operation is used for all relevant
   * interaction with the viewer.
   */
  QUIET = 2,
}

// ============================================================================
// Channel ID Types
// ============================================================================

/**
 * Channel identification type constants.
 *
 * These constants identify the type of channel and determine which
 * properties are used for channel identification.
 */
export enum ChannelIdType {
  /** DVB-C (Cable) channel identified by DVB triplet */
  ID_DVB_C = 0,

  /** DVB-S (Satellite) channel identified by DVB triplet */
  ID_DVB_S = 1,

  /** DVB-T (Terrestrial) channel identified by DVB triplet */
  ID_DVB_T = 2,

  /** DVB-C2 (Cable second generation) channel */
  ID_DVB_C2 = 3,

  /** DVB-S2 (Satellite second generation) channel */
  ID_DVB_S2 = 4,

  /** DVB-T2 (Terrestrial second generation) channel */
  ID_DVB_T2 = 5,

  /** ATSC-T channel identified by source_ID */
  ID_ATSC_T = 10,

  /** Analogue channel */
  ID_ANALOG = 11,

  /** IPTV channel via SDS (Service Discovery and Selection) */
  ID_IPTV_SDS = 12,

  /**
   * DVB-SI direct channel.
   *
   * Channel identified by delivery system descriptor and service ID.
   * Created via createChannelObject() with tuning parameters.
   */
  ID_DVB_SI_DIRECT = 13,

  /** IPTV channel via URI */
  ID_IPTV_URI = 14,

  /** ISDB-C channel */
  ID_ISDB_C = 20,

  /** ISDB-S channel */
  ID_ISDB_S = 21,

  /** ISDB-T channel */
  ID_ISDB_T = 22,
}

// ============================================================================
// Channel Type Constants
// ============================================================================

/**
 * Channel type constants indicating the nature of the channel content.
 */
export enum ChannelType {
  /** Television channel */
  TYPE_TV = 0,

  /** Radio channel */
  TYPE_RADIO = 1,

  /** Other/data channel */
  TYPE_OTHER = 2,
}

// ============================================================================
// Stream Event Status
// ============================================================================

/**
 * Status values for DSM-CC StreamEvent events.
 *
 * Indicates whether the event was dispatched due to an actual trigger
 * in the stream or due to an error condition.
 *
 * @see StreamEvent
 * @since HbbTV 1.0
 */
export type StreamEventStatus = "trigger" | "error";

/**
 * MIME type for the video/broadcast embedded object.
 */
export const VIDEO_BROADCAST_MIME_TYPE = "video/broadcast" as const;
