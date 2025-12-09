/**
 * HbbTV Video/Broadcast Event Types
 *
 * Event handler type aliases and DOM event interfaces for the
 * video/broadcast embedded object.
 *
 * @see OIPF DAE Specification
 * @see HbbTV Specification
 */

import type { ComponentType } from "../../av/component/component";
import type { Channel } from "./channel";
import type { ParentalRatingCollection } from "./parentalRating";
import type { PlayState } from "./videoBroadcast";

// ============================================================================
// Error Codes and States
// ============================================================================

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
 * Status values for DSM-CC StreamEvent events.
 *
 * Indicates whether the event was dispatched due to an actual trigger
 * in the stream or due to an error condition.
 *
 * @see StreamEvent
 * @since HbbTV 1.0
 */
export type StreamEventStatus = "trigger" | "error";

// ============================================================================
// Event Handler Types
// ============================================================================

/**
 * Handler for play state change events.
 *
 * Called when the play state of the video/broadcast object changes,
 * including changes from a state back to the same state.
 *
 * @param state - The new state of the video/broadcast object (PlayState value)
 * @param error - Error code if the state changed due to an error, undefined otherwise
 */
export type OnPlayStateChangeHandler = (state: PlayState, error?: ChannelChangeErrorCode) => void;

/**
 * Handler for full screen change events.
 *
 * Called when the value of `fullScreen` changes.
 */
export type OnFullScreenChangeHandler = () => void;

/**
 * Handler for focus events.
 *
 * Called when the video object gains focus.
 */
export type OnFocusHandler = () => void;

/**
 * Handler for blur events.
 *
 * Called when the video object loses focus.
 */
export type OnBlurHandler = () => void;

/**
 * Handler for successful channel change events.
 *
 * Called when a request to switch a tuner to another channel has successfully
 * completed. May be called in response to an application-initiated or
 * terminal-initiated channel change.
 *
 * @param channel - The channel to which the tuner switched
 */
export type OnChannelChangeSucceededHandler = (channel: Channel) => void;

/**
 * Handler for channel change error events.
 *
 * Called when a request to switch a tuner to another channel resulted in
 * an error preventing the broadcasted content from being rendered.
 *
 * @param channel - The Channel object to which a channel switch was requested
 * @param errorState - Error code detailing the type of error
 */
export type OnChannelChangeErrorHandler = (channel: Channel, errorState: ChannelChangeErrorCode) => void;

/**
 * Handler for programmes changed events.
 *
 * Called when the `programmes` property has been updated with new programme
 * information, e.g. when the current broadcast programme is finished and
 * a new one has started.
 */
export type OnProgrammesChangedHandler = () => void;

/**
 * Handler for parental rating change events.
 *
 * Called whenever the parental rating of the content being played inside
 * the embedded object changes. May occur at the start of a new content item
 * or during playback.
 *
 * @param contentID - Content ID to which the parental rating change applies.
 *                    If generated by DRM system, it's the unique identifier for
 *                    that content in the DRM context. Otherwise null or undefined.
 * @param ratings - The parental ratings of the currently playing content
 * @param DRMSystemID - The DRM System ID that generated the event, or null
 * @param blocked - Whether consumption is blocked by parental control system
 */
export type OnParentalRatingChangeHandler = (
  contentID: string | null | undefined,
  ratings: ParentalRatingCollection,
  DRMSystemID: string | null,
  blocked: boolean,
) => void;

/**
 * Handler for parental rating error events.
 *
 * Called when a parental rating error occurs during playback. Triggered when
 * one or more parental ratings are discovered and none of them are valid.
 *
 * A valid parental rating uses a scheme supported by the terminal with a
 * value that is also supported.
 *
 * @param contentID - Content ID to which the parental rating error applies
 * @param ratings - The parental ratings of the currently playing content
 * @param DRMSystemID - The DRM System ID that generated the event (optional)
 */
export type OnParentalRatingErrorHandler = (
  contentID: string | null | undefined,
  ratings: ParentalRatingCollection,
  DRMSystemID?: string | null,
) => void;

/**
 * Handler for DRM rights error events.
 *
 * Called whenever a rights error or rights change occurs for A/V content.
 * This may occur during playback, recording, or timeshifting of DRM protected
 * content.
 *
 * @note Only supported on terminals that support CI Plus.
 *
 * @param errorState - Error code detailing the type of error
 * @param contentID - Unique identifier of the protected content in the DRM scope
 * @param DRMSystemID - DRM System ID as defined in OIPF specification
 * @param rightsIssuerURL - URL to obtain rights for the content (optional)
 */
export type OnDRMRightsErrorHandler = (
  errorState: DRMRightsErrorState,
  contentID: string | null,
  DRMSystemID: string,
  rightsIssuerURL?: string,
) => void;

/**
 * Handler for selected component change events.
 *
 * Called when there is a change in the set of components being presented.
 * This may occur if a currently selected component is no longer available
 * and an alternative is chosen, or when presentation has changed due to
 * a different component being selected.
 *
 * @param componentType - The type of component whose presentation changed,
 *                        or undefined if more than one type changed
 */
export type OnSelectedComponentChangedHandler = (componentType?: ComponentType) => void;

/**
 * Handler for component change events.
 *
 * Called when there is a change in the set of components in the current
 * stream (i.e. components returned by `getComponents()`).
 *
 * @param componentType - The type of component for which there was a change,
 *                        or undefined if more than one type changed
 */
export type OnComponentChangedHandler = (componentType?: ComponentType) => void;

// ============================================================================
// DOM Event Interfaces
// ============================================================================

/**
 * DOM event dispatched when focus is gained.
 *
 * @event focus
 * @bubbles No
 * @cancelable No
 */
export interface FocusEvent extends Event {
  readonly type: "focus";
}

/**
 * DOM event dispatched when focus is lost.
 *
 * @event blur
 * @bubbles No
 * @cancelable No
 */
export interface BlurEvent extends Event {
  readonly type: "blur";
}

/**
 * DOM event dispatched when full screen state changes.
 *
 * @event FullScreenChange
 * @bubbles No
 * @cancelable No
 */
export interface FullScreenChangeEvent extends Event {
  readonly type: "FullScreenChange";
}

/**
 * DOM event dispatched when a channel change fails.
 *
 * @event ChannelChangeError
 * @bubbles No
 * @cancelable No
 */
export interface ChannelChangeErrorEvent extends Event {
  readonly type: "ChannelChangeError";
  /** The channel to which a switch was requested */
  readonly channel: Channel;
  /** Error code detailing the type of error */
  readonly errorState: ChannelChangeErrorCode;
}

/**
 * DOM event dispatched when a channel change succeeds.
 *
 * @event ChannelChangeSucceeded
 * @bubbles No
 * @cancelable No
 */
export interface ChannelChangeSucceededEvent extends Event {
  readonly type: "ChannelChangeSucceeded";
  /** The channel to which the tuner switched */
  readonly channel: Channel;
}

/**
 * DOM event dispatched when play state changes.
 *
 * @event PlayStateChange
 * @bubbles No
 * @cancelable No
 */
export interface PlayStateChangeEvent extends Event {
  readonly type: "PlayStateChange";
  /** The new state of the video/broadcast object */
  readonly state: PlayState;
  /** Error code if the state changed due to an error */
  readonly error?: ChannelChangeErrorCode;
}

/**
 * DOM event dispatched when programme information is updated.
 *
 * @event ProgrammesChanged
 * @bubbles No
 * @cancelable No
 */
export interface ProgrammesChangedEvent extends Event {
  readonly type: "ProgrammesChanged";
}

/**
 * DOM event dispatched when parental rating changes.
 *
 * @event ParentalRatingChange
 * @bubbles No
 * @cancelable No
 */
export interface ParentalRatingChangeEvent extends Event {
  readonly type: "ParentalRatingChange";
  readonly contentID: string | null | undefined;
  readonly ratings: ParentalRatingCollection;
  readonly DRMSystemID: string | null;
  readonly blocked: boolean;
}

/**
 * DOM event dispatched when a parental rating error occurs.
 *
 * @event ParentalRatingError
 * @bubbles No
 * @cancelable No
 */
export interface ParentalRatingErrorEvent extends Event {
  readonly type: "ParentalRatingError";
  readonly contentID: string | null | undefined;
  readonly ratings: ParentalRatingCollection;
  readonly DRMSystemID?: string | null;
}

/**
 * DOM event dispatched when a DRM rights error occurs.
 *
 * @event DRMRightsError
 * @bubbles No
 * @cancelable No
 */
export interface DRMRightsErrorEvent extends Event {
  readonly type: "DRMRightsError";
  readonly errorState: DRMRightsErrorState;
  readonly contentID: string | null;
  readonly DRMSystemID: string;
  readonly rightsIssuerURL?: string;
}

/**
 * DOM event dispatched when component selection changes.
 *
 * @event ComponentChanged
 * @bubbles No
 * @cancelable No
 */
export interface ComponentChangedEvent extends Event {
  readonly type: "ComponentChanged";
  readonly componentType?: ComponentType;
}

// ============================================================================
// DSM-CC Stream Events
// ============================================================================

/**
 * DSM-CC StreamEvent event interface.
 *
 * Dispatched when a DSM-CC stream event is received from the broadcast stream,
 * or when an error occurs in monitoring the stream event.
 *
 * Stream events provide a mechanism for broadcasters to signal applications
 * at specific points in the broadcast, enabling synchronized interactive content.
 *
 * @event StreamEvent
 * @bubbles No
 * @cancelable No
 *
 * @see HbbTV Specification Clause 7.2.4
 * @since HbbTV 1.0
 */
export interface StreamEvent extends Event {
  /**
   * The name of the DSM-CC StreamEvent's event.
   *
   * This is the event name specified in the DSM-CC stream event descriptor.
   */
  readonly name: string;

  /**
   * Data of the DSM-CC StreamEvent's event encoded in hexadecimal.
   *
   * The raw binary payload of the stream event is encoded as a hexadecimal string.
   *
   * @example "0A10B81033" (for a 5-byte payload)
   */
  readonly data: string;

  /**
   * Text data of the DSM-CC StreamEvent's event as a UTF-8 string.
   *
   * The binary payload is interpreted as UTF-8 encoded text.
   * Characters that cannot be transcoded are skipped.
   *
   * @security Application developers should be aware that in some circumstances
   * an attacker may be able to modify the broadcast signalling from which this
   * data is derived. Applications shall not use this data in a way that would
   * result in it being executed by the browser. Applications should be written
   * to be tolerant of incorrectly formatted data or values outside the expected
   * range without hanging up or crashing.
   */
  readonly text: string;

  /**
   * Status indicating how this event was dispatched.
   *
   * - `"trigger"`: The event was dispatched in response to a trigger in the stream.
   * - `"error"`: An error occurred. Possible causes include:
   *   - The StreamEvent object pointed to by targetURL is not found in the carousel or via broadband
   *   - The StreamEvent object does not contain the event specified by eventName
   *   - The carousel cannot be mounted
   *   - The elementary stream containing the StreamEvent descriptor is no longer being monitored
   *
   * Once an error is dispatched, the listener is automatically unregistered by the terminal.
   */
  readonly status: "trigger" | "error";
}

/**
 * Type for stream event listener callback function.
 *
 * @param event - The StreamEvent dispatched by the terminal
 */
export type StreamEventListener = (event: StreamEvent) => void;
