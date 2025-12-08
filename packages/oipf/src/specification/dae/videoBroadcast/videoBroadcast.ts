/**
 * HbbTV Video/Broadcast Embedded Object API
 *
 * The video/broadcast embedded object enables HbbTV applications to interact with
 * and control the underlying broadcast and video playback capabilities of a connected
 * TV device. It provides a standardized interface to access linear broadcast content,
 * manage media playback, retrieve metadata, and control trick-play functions.
 *
 * Key capabilities include:
 * - Tuning to broadcast channels via channel objects and channel lists
 * - Retrieving EPG data (Electronic Programme Guide) and programme metadata
 * - Controlling playback (e.g. play, pause, stop) for broadcast and AV content
 * - Listening for broadcast events such as channel changes and signal loss
 * - Accessing media components, such as video, audio, and subtitles
 *
 * The object adheres to the OIPF (Open IPTV Forum) specification, as adopted and
 * extended by the HbbTV standard.
 *
 * @see OIPF DAE Specification
 * @see HbbTV Specification
 */

import type { Component } from "../../av/component";
import type { Channel, ChannelConfig, ChannelIdType } from "./channel";
import type {
  OnBlurHandler,
  OnChannelChangeErrorHandler,
  OnChannelChangeSucceededHandler,
  OnComponentChangedHandler,
  OnDRMRightsErrorHandler,
  OnFocusHandler,
  OnFullScreenChangeHandler,
  OnParentalRatingChangeHandler,
  OnParentalRatingErrorHandler,
  OnPlayStateChangeHandler,
  OnProgrammesChangedHandler,
  OnSelectedComponentChangedHandler,
  StreamEventListener,
} from "./events";
import type { ProgrammeCollection } from "./programme";

// ============================================================================
// Play State
// ============================================================================

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

// ============================================================================
// Quiet Mode
// ============================================================================

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
// VideoBroadcast Interface
// ============================================================================

/**
 * Base type for VideoBroadcast that omits properties with incompatible types.
 *
 * HTMLObjectElement defines `width` and `height` as `string`, but HbbTV
 * specifies them as `Integer`. We use Omit to allow redefinition.
 */
type VideoBroadcastBase = Omit<HTMLObjectElement, "width" | "height">;

/**
 * Video/Broadcast embedded object interface.
 *
 * This interface represents the complete API surface of an HbbTV video/broadcast
 * object (`<object type="video/broadcast">`).
 *
 * ## State Model
 *
 * The video/broadcast object operates in one of four states:
 * - **Unrealized**: No channel bound, resources released
 * - **Connecting**: Attempting to connect to a channel
 * - **Presenting**: Media is being presented to the user
 * - **Stopped**: Bound to a channel but not presenting
 *
 * ## Usage
 *
 * Broadcast-related applications have full access to this object.
 * Broadcast-independent applications have restricted access:
 * - `getChannelConfig()`, `bindToCurrentChannel()`, `prevChannel()`,
 *   `nextChannel()` will throw a "Security Error"
 * - `setFullScreen()`, `release()`, `stop()` will have no effect
 *
 * @example
 * ```typescript
 * // Get the video/broadcast object from the DOM
 * const vb = document.getElementById('video') as VideoBroadcast;
 *
 * // Bind to the current channel
 * vb.onPlayStateChange = (state, error) => {
 *   if (state === PlayState.PRESENTING) {
 *     console.log('Now presenting:', vb.currentChannel?.name);
 *   }
 * };
 *
 * const channel = vb.bindToCurrentChannel();
 * ```
 *
 * @see PlayState
 * @see Component.ComponentType
 * @see ChannelChangeErrorCode
 */
export interface VideoBroadcast extends VideoBroadcastBase {
  // ==========================================================================
  // Constants (defined on the object instance)
  // ==========================================================================

  /** Represents a video component. @see Component.ComponentType.VIDEO */
  readonly COMPONENT_TYPE_VIDEO: 0;

  /** Represents an audio component. @see Component.ComponentType.AUDIO */
  readonly COMPONENT_TYPE_AUDIO: 1;

  /** Represents a subtitle component. @see Component.ComponentType.SUBTITLE */
  readonly COMPONENT_TYPE_SUBTITLE: 2;

  // ==========================================================================
  // Properties
  // ==========================================================================

  /**
   * The width of the area used for rendering the video object.
   *
   * This property is only writable if `fullScreen` is `false`.
   *
   * Changing this property has the same effect as changing the width through
   * the HTMLObjectElement interface or via CSS (style.width) for pixel values.
   */
  width: number;

  /**
   * The height of the area used for rendering the video object.
   *
   * This property is only writable if `fullScreen` is `false`.
   *
   * Changing this property has the same effect as changing the height through
   * the HTMLObjectElement interface or via CSS (style.height) for pixel values.
   */
  height: number;

  /**
   * Indicates whether this video object is in full-screen mode.
   *
   * @default false
   * @readonly
   */
  readonly fullScreen: boolean;

  /**
   * The data property of the video/broadcast object.
   *
   * Setting this property has no effect. Reading returns an empty string.
   */
  data: string;

  /**
   * The current play state of the video/broadcast object.
   *
   * @see PlayState
   * @readonly
   */
  readonly playState: PlayState;

  /**
   * The channel currently being presented by this embedded object.
   *
   * Returns `null` if:
   * - No channel is being presented
   * - The information is not visible to the calling application
   * - Called by a broadcast-independent application
   *
   * The value is not affected during timeshift operations and will reflect
   * the value prior to the start of a timeshift operation.
   *
   * @readonly
   */
  readonly currentChannel: Channel | null;

  /**
   * Collection of programmes available on the currently tuned channel.
   *
   * This list is ordered by start time, so index 0 refers to the present
   * programme (if available).
   *
   * If the terminal's `clientMetadata` type attribute is "eit-pf", this list
   * provides Programme objects for the present and directly following
   * programme only (length <= 2).
   *
   * Returns a collection of length 0 if:
   * - Not currently tuned to a channel
   * - Present/following information not yet retrieved
   * - Present/following information not available for current channel
   *
   * @readonly
   */
  readonly programmes: ProgrammeCollection;

  // ==========================================================================
  // Event Handlers (intrinsic events)
  // ==========================================================================

  /** Handler for play state change events. @see OnPlayStateChangeHandler */
  onPlayStateChange: OnPlayStateChangeHandler | null;

  /** Handler for full screen change events. */
  onFullScreenChange: OnFullScreenChangeHandler | null;

  /** Handler for focus events. */
  onfocus: OnFocusHandler | null;

  /** Handler for blur events. */
  onblur: OnBlurHandler | null;

  /** Handler for successful channel change events. */
  onChannelChangeSucceeded: OnChannelChangeSucceededHandler | null;

  /** Handler for channel change error events. */
  onChannelChangeError: OnChannelChangeErrorHandler | null;

  /** Handler for programmes changed events. */
  onProgrammesChanged: OnProgrammesChangedHandler | null;

  /** Handler for parental rating change events. */
  onParentalRatingChange: OnParentalRatingChangeHandler | null;

  /** Handler for parental rating error events. */
  onParentalRatingError: OnParentalRatingErrorHandler | null;

  /** Handler for DRM rights error events. @note Only for CI Plus terminals. */
  onDRMRightsError: OnDRMRightsErrorHandler | null;

  /** Handler for selected component change events. */
  onSelectedComponentChanged: OnSelectedComponentChangedHandler | null;

  /** Handler for component change events. */
  onComponentChanged: OnComponentChangedHandler | null;

  // ==========================================================================
  // Methods
  // ==========================================================================

  /**
   * Returns the channel line-up of the tuner as a ChannelConfig object.
   *
   * @returns The channel configuration, or `null` if the channel list is
   *          not managed by the terminal (managed entirely in the network).
   *
   * @throws {DOMException} "SecurityError" for broadcast-independent applications
   */
  getChannelConfig(): ChannelConfig | null;

  /**
   * Binds the video/broadcast object to the current channel.
   *
   * ## From Unrealized State
   * If exactly one channel is currently being presented by the terminal,
   * binds to that channel (even if it doesn't contain video/audio).
   * If multiple channels are presented, binds to the one whose audio
   * is being presented.
   *
   * ## From Stopped State
   * Restarts presentation of video and audio from the current channel.
   * Fails if suitable media decoders are not available.
   *
   * @returns The Channel object bound, or null if the operation fails
   * @throws {DOMException} "SecurityError" for broadcast-independent applications
   */
  bindToCurrentChannel(): Channel | null;

  /**
   * Creates a Channel object of type ID_DVB_SI_DIRECT.
   *
   * @param idType - The type of channel. Only ID_DVB_SI_DIRECT (13) is valid.
   * @param dsd - The delivery system descriptor as a Latin-1 encoded string.
   * @param sid - The service ID (1-65535)
   * @returns A Channel object, or `null` if invalid.
   */
  createChannelObject(idType: ChannelIdType.ID_DVB_SI_DIRECT, dsd: string, sid: number): Channel | null;

  /**
   * Creates a Channel object of the specified type.
   *
   * @param idType - The type of channel (one of the ID_* constants)
   * @param onid - Original network ID
   * @param tsid - Transport stream ID
   * @param sid - Service ID
   * @param sourceID - Source ID (for ATSC)
   * @param ipBroadcastID - DVB textual service identifier or URI
   * @returns A Channel object, or `null` if invalid.
   */
  createChannelObject(
    idType: ChannelIdType,
    onid?: number,
    tsid?: number,
    sid?: number,
    sourceID?: number,
    ipBroadcastID?: string,
  ): Channel | null;

  /**
   * Requests the terminal to switch to the specified channel.
   *
   * @param channel - The channel to switch to, or `null` to release
   * @param trickplay - Hint to allocate trick play resources
   * @param contentAccessDescriptorURL - Not used by HbbTV
   * @param quiet - Quiet mode for the channel change
   */
  setChannel(
    channel: Channel | null,
    trickplay?: boolean,
    contentAccessDescriptorURL?: string,
    quiet?: QuietMode,
  ): void;

  /**
   * Switches to the previous channel in the active favourite/channel list.
   * @throws {DOMException} "SecurityError" for broadcast-independent applications
   */
  prevChannel(): void;

  /**
   * Switches to the next channel in the active favourite/channel list.
   * @throws {DOMException} "SecurityError" for broadcast-independent applications
   */
  nextChannel(): void;

  /**
   * Adjusts the volume of the currently playing media.
   * @since HbbTV 1.7.1
   * @param volume - Integer value from 0 to 100
   * @returns `true` if the volume changed
   */
  setVolume(volume: number): boolean;

  /**
   * Returns the actual volume level set.
   * @since HbbTV 1.7.1
   * @returns The current volume level (0-100)
   */
  getVolume(): number;

  /** Releases the decoder/tuner and all associated resources. */
  release(): void;

  /** Stops presenting broadcast video. Transitions to stopped state. */
  stop(): void;

  /**
   * Returns the components of the specified type in the current stream.
   * @param componentType - The type of component, or null for all
   * @returns Collection of AVComponent values, or undefined if not known
   */
  getComponents(componentType?: Component.ComponentType | null): Component.AVComponentCollection | undefined;

  /**
   * Returns the currently active components being rendered.
   * @param componentType - The type of component, or undefined for all
   */
  getCurrentActiveComponents(componentType?: Component.ComponentType): Component.AVComponentCollection | undefined;

  /**
   * Selects a component for rendering.
   * @param component - A component object from the current stream
   */
  selectComponent(component: Component.AVComponent): void;

  /**
   * Selects the default component of the specified type.
   * @param componentType - The type of component to select
   */
  selectComponent(componentType: Component.ComponentType): void;

  /**
   * Stops rendering the specified component.
   * @param component - The component to stop
   */
  unselectComponent(component: Component.AVComponent): void;

  /**
   * Stops rendering all components of the specified type.
   * @param componentType - The type of component to stop
   */
  unselectComponent(componentType: Component.ComponentType): void;

  /**
   * Requests full screen mode.
   * @param fullScreen - `true` to enter full screen, `false` to exit
   */
  setFullScreen(fullScreen: boolean): void;

  // ==========================================================================
  // DSM-CC Stream Events (HbbTV 1.0+)
  // ==========================================================================

  /**
   * Adds a listener for the specified DSM-CC stream event.
   *
   * When a broadcaster transmits an identical instance of the MPEG private data
   * section carrying a stream event descriptor (including the version number),
   * only one StreamEvent event shall be dispatched.
   *
   * When a broadcaster transmits different events using the same event name id
   * (i.e. with different version numbers), one StreamEvent event shall be
   * dispatched for each different stream event descriptor received.
   *
   * An event shall also be dispatched in case of error.
   *
   * ## State Requirements
   *
   * Listeners can only be added while the video/broadcast object is in the
   * **Presenting** or **Stopped** states. Calls to this function when the
   * object is in other states shall have no effect.
   *
   * ## Automatic Unregistration
   *
   * The terminal shall automatically unregister all listeners in the following cases:
   * - A transition to the **Unrealized** state (e.g. when becoming broadcast-independent)
   * - A transition to the **Connecting** state due to a channel change
   *
   * Listeners are **not** unregistered when transitioning to the Connecting state
   * due to a transient error that does not result in a change of channel.
   *
   * @param targetURL - The URL of the DSM-CC StreamEvent object, or an HTTP/HTTPS URL
   *                    referring to an XML event description file (as defined in
   *                    ETSI TS 102 809 clause 8.2 and profiled in HbbTV clause 7.2.4)
   * @param eventName - The name of the event (of the DSM-CC StreamEvent object)
   *                    that shall be subscribed to
   * @param listener - The listener callback for the event
   *
   * @see StreamEvent
   * @see removeStreamEventListener
   * @since HbbTV 1.0
   */
  addStreamEventListener(targetURL: string, eventName: string, listener: StreamEventListener): void;

  /**
   * Removes a stream event listener for the specified stream event name.
   *
   * @param targetURL - The URL of the DSM-CC StreamEvent object or an HTTP/HTTPS URL
   *                    referring to an event description file describing the event
   * @param eventName - The name of the event (of the DSM-CC StreamEvent object)
   *                    whose subscription shall be removed
   * @param listener - The listener to remove
   *
   * @see addStreamEventListener
   * @since HbbTV 1.0
   */
  removeStreamEventListener(targetURL: string, eventName: string, listener: StreamEventListener): void;
}

export const MIME_TYPE = "video/broadcast" as const;

export const isValidElement = (element: Element | null | undefined): element is HTMLObjectElement =>
  element instanceof HTMLObjectElement && element.type === MIME_TYPE;
