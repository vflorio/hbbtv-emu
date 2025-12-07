import { Broadcast, createLogger } from "@hbb-emu/core";
import { AVVideoObjectBase } from "./avVideoObjectBase";

const logger = createLogger("AvVideoBroadcast");

/**
 * A/V Control object for broadcast video.
 *
 * Implements the video/broadcast MIME type for HbbTV applications.
 * Provides channel tuning, EPG access, and component selection.
 *
 * @see Broadcast.VideoBroadcast
 */
export class AvVideoBroadcast extends AVVideoObjectBase {
  static readonly MIME_TYPE = Broadcast.VideoBroadcast.MIME_TYPE;

  // ═══════════════════════════════════════════════════════════════════════════
  // Broadcast-specific State
  // ═══════════════════════════════════════════════════════════════════════════

  protected _broadcastPlayState: Broadcast.VideoBroadcast.PlayState = Broadcast.VideoBroadcast.PlayState.UNREALIZED;

  // ═══════════════════════════════════════════════════════════════════════════
  // Constants (COMPONENT_TYPE_*)
  // ═══════════════════════════════════════════════════════════════════════════

  readonly COMPONENT_TYPE_VIDEO = 0 as const;
  readonly COMPONENT_TYPE_AUDIO = 1 as const;
  readonly COMPONENT_TYPE_SUBTITLE = 2 as const;

  // ═══════════════════════════════════════════════════════════════════════════
  // Broadcast-specific Event Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  onChannelChangeSucceeded: Broadcast.Events.OnChannelChangeSucceededHandler | null = null;
  onChannelChangeError: Broadcast.Events.OnChannelChangeErrorHandler | null = null;
  onProgrammesChanged: Broadcast.Events.OnProgrammesChangedHandler | null = null;
  onParentalRatingChange: Broadcast.Events.OnParentalRatingChangeHandler | null = null;
  onParentalRatingError: Broadcast.Events.OnParentalRatingErrorHandler | null = null;
  onDRMRightsError: Broadcast.Events.OnDRMRightsErrorHandler | null = null;
  onSelectedComponentChanged: Broadcast.Events.OnSelectedComponentChangedHandler | null = null;
  onComponentChanged: Broadcast.Events.OnComponentChangedHandler | null = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // Broadcast-specific Properties
  // ═══════════════════════════════════════════════════════════════════════════

  get currentChannel(): Broadcast.Channel.Channel | null {
    // TODO: Implement channel management
    return null;
  }

  get programmes(): Broadcast.Programme.ProgrammeCollection {
    // TODO: Implement EPG
    return { length: 0, item: () => undefined };
  }

  constructor() {
    super();
    logger.info("initialized")();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Channel Methods
  // ═══════════════════════════════════════════════════════════════════════════

  getChannelConfig = (): Broadcast.Channel.ChannelConfig | null => {
    logger.debug("getChannelConfig")();
    // TODO: Implement
    return null;
  };

  bindToCurrentChannel = (): Broadcast.Channel.Channel | null => {
    logger.debug("bindToCurrentChannel")();
    this._broadcastPlayState = Broadcast.VideoBroadcast.PlayState.PRESENTING;
    // TODO: Implement
    return null;
  };

  createChannelObject = (
    _idType: Broadcast.Channel.ChannelIdType,
    _onidOrDsd?: number | string,
    _tsid?: number,
    _sid?: number,
    _sourceID?: number,
    _ipBroadcastID?: string,
  ): Broadcast.Channel.Channel | null => {
    logger.debug("createChannelObject")();
    // TODO: Implement
    return null;
  };

  setChannel = (
    _channel: Broadcast.Channel.Channel | null,
    _trickplay?: boolean,
    _contentAccessDescriptorURL?: string,
    _quiet?: Broadcast.VideoBroadcast.QuietMode,
  ): void => {
    logger.debug("setChannel")();
    // TODO: Implement
  };

  prevChannel = (): void => {
    logger.debug("prevChannel")();
    // TODO: Implement
  };

  nextChannel = (): void => {
    logger.debug("nextChannel")();
    // TODO: Implement
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Volume Methods
  // ═══════════════════════════════════════════════════════════════════════════

  getVolume = (): number => {
    return Math.round(this.videoElement.volume * 100);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle Methods
  // ═══════════════════════════════════════════════════════════════════════════

  release = (): void => {
    logger.debug("release")();
    this.stop();
    this._broadcastPlayState = Broadcast.VideoBroadcast.PlayState.UNREALIZED;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Component Methods
  // ═══════════════════════════════════════════════════════════════════════════

  getComponents = (_componentType?: number | null): undefined => {
    logger.debug("getComponents")();
    // TODO: Implement
    return undefined;
  };

  getCurrentActiveComponents = (_componentType?: number): undefined => {
    logger.debug("getCurrentActiveComponents")();
    // TODO: Implement
    return undefined;
  };

  selectComponent = (_component: unknown): void => {
    logger.debug("selectComponent")();
    // TODO: Implement
  };

  unselectComponent = (_component: unknown): void => {
    logger.debug("unselectComponent")();
    // TODO: Implement
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Stream Event Methods
  // ═══════════════════════════════════════════════════════════════════════════

  addStreamEventListener = (
    _targetURL: string,
    _eventName: string,
    _listener: Broadcast.Events.StreamEventListener,
  ): void => {
    logger.debug("addStreamEventListener")();
    // TODO: Implement
  };

  removeStreamEventListener = (
    _targetURL: string,
    _eventName: string,
    _listener: Broadcast.Events.StreamEventListener,
  ): void => {
    logger.debug("removeStreamEventListener")();
    // TODO: Implement
  };
}
