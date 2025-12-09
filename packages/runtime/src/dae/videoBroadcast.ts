import {
  createLogger,
  createStatefulMethods,
  deriveSchema,
  type OnStateChangeCallback,
  type Stateful,
} from "@hbb-emu/core";
import {
  DEFAULT_BROADCAST_PLAY_STATE,
  DEFAULT_FULL_SCREEN,
  DEFAULT_VIDEO_HEIGHT,
  DEFAULT_VIDEO_WIDTH,
  OIPF,
  type VideoBroadcastState,
  VideoBroadcastStateCodec,
} from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { ObjectDefinition } from "../objectDefinitions";
import { StreamPlayState } from "../providers/videoStream";
import { ObjectVideoStream } from "../providers/videoStream/objectVideoStream";

const logger = createLogger("VideoBroadcast");

export const videoBroadcastDefinition: ObjectDefinition<VideoBroadcast, VideoBroadcastState, "videoBroadcast"> = {
  name: "VideoBroadcast",
  selector: `object[type="${OIPF.DAE.Broadcast.MIME_TYPE}"]`,
  predicate: OIPF.DAE.Broadcast.isValidElement,
  factory: () => new VideoBroadcast(),
  stateKey: "videoBroadcast",
  attachStrategy: "proxy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

// ─────────────────────────────────────────────────────────────────────────────
// Video/Broadcast Object
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Video/Broadcast embedded object implementation using video backend.
 *
 * Provides:
 * - Stream player interface via WithVideoBackend mixin
 * - State mapping from stream states to VideoBroadcast.PlayState
 * - Full HbbTV video/broadcast API compliance
 */
export class VideoBroadcast
  extends ObjectVideoStream
  implements OIPF.DAE.Broadcast.VideoBroadcast, Stateful<VideoBroadcastState>
{
  static readonly MIME_TYPE = OIPF.DAE.Broadcast.MIME_TYPE;

  // ═══════════════════════════════════════════════════════════════════════════
  // Stateful Interface
  // ═══════════════════════════════════════════════════════════════════════════

  readonly stateful = createStatefulMethods(
    deriveSchema<VideoBroadcastState, VideoBroadcast>(VideoBroadcastStateCodec),
    this,
  );

  applyState = (state: Partial<VideoBroadcastState>): IO.IO<void> => this.stateful.applyState(state);

  getState = (): IO.IO<Partial<VideoBroadcastState>> => this.stateful.getState();

  subscribe = (callback: OnStateChangeCallback<VideoBroadcastState>): IO.IO<() => void> =>
    this.stateful.subscribe(callback);

  notifyStateChange = (changedKeys: ReadonlyArray<keyof VideoBroadcastState>): IO.IO<void> =>
    this.stateful.notifyStateChange(changedKeys);

  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  protected _playState: OIPF.DAE.Broadcast.PlayState = DEFAULT_BROADCAST_PLAY_STATE;
  protected _fullScreen = DEFAULT_FULL_SCREEN;
  protected _width = DEFAULT_VIDEO_WIDTH;
  protected _height = DEFAULT_VIDEO_HEIGHT;
  protected _currentChannel: OIPF.DAE.Broadcast.Channel | null = null;
  // ═══════════════════════════════════════════════════════════════════════════
  // Constants (COMPONENT_TYPE_*)
  // ═══════════════════════════════════════════════════════════════════════════

  readonly COMPONENT_TYPE_VIDEO = 0 as const;
  readonly COMPONENT_TYPE_AUDIO = 1 as const;
  readonly COMPONENT_TYPE_SUBTITLE = 2 as const;

  // ═══════════════════════════════════════════════════════════════════════════
  // Event Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  onPlayStateChange: OIPF.DAE.Broadcast.OnPlayStateChangeHandler | null = null;
  onFullScreenChange: OIPF.DAE.Broadcast.OnFullScreenChangeHandler | null = null;
  onfocus: OIPF.DAE.Broadcast.OnFocusHandler | null = null;
  onblur: OIPF.DAE.Broadcast.OnBlurHandler | null = null;
  onChannelChangeSucceeded: OIPF.DAE.Broadcast.OnChannelChangeSucceededHandler | null = null;
  onChannelChangeError: OIPF.DAE.Broadcast.OnChannelChangeErrorHandler | null = null;
  onProgrammesChanged: OIPF.DAE.Broadcast.OnProgrammesChangedHandler | null = null;
  onParentalRatingChange: OIPF.DAE.Broadcast.OnParentalRatingChangeHandler | null = null;
  onParentalRatingError: OIPF.DAE.Broadcast.OnParentalRatingErrorHandler | null = null;
  onDRMRightsError: OIPF.DAE.Broadcast.OnDRMRightsErrorHandler | null = null;
  onSelectedComponentChanged: OIPF.DAE.Broadcast.OnSelectedComponentChangedHandler | null = null;
  onComponentChanged: OIPF.DAE.Broadcast.OnComponentChangedHandler | null = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════════════

  constructor() {
    super();
    this.#setupBackendEventListeners();
    logger.info("Initialized")();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Backend Event Integration
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Connect backend events to HbbTV API events.
   */
  #setupBackendEventListeners = (): void => {
    // Map stream state changes to HbbTV playState
    this.onStreamStateChange((streamState) => {
      const broadcastState = mapStreamToVideoBroadcast(streamState);
      this.setPlayState(broadcastState);

      // Handle channel change success when presenting
      if (streamState === StreamPlayState.PLAYING && this._currentChannel) {
        this.onChannelChangeSucceeded?.(this._currentChannel);
      }
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Properties
  // ═══════════════════════════════════════════════════════════════════════════

  get playState(): OIPF.DAE.Broadcast.PlayState {
    return this._playState;
  }

  get fullScreen(): boolean {
    return this._fullScreen;
  }

  get width(): number {
    return this._width;
  }

  set width(value: number) {
    if (!this._fullScreen) {
      this._width = value;
      this.backendSetSize(value, this._height);
    }
  }

  get height(): number {
    return this._height;
  }

  set height(value: number) {
    if (!this._fullScreen) {
      this._height = value;
      this.backendSetSize(this._width, value);
    }
  }

  get data(): string {
    return "";
  }

  set data(_value: string) {
    // Setting data property has no effect for video/broadcast
  }

  get currentChannel(): OIPF.DAE.Broadcast.Channel | null {
    return this._currentChannel;
  }

  get programmes(): OIPF.DAE.Broadcast.ProgrammeCollection {
    // TODO: Implement EPG
    return { length: 0, item: () => undefined };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Display Methods
  // ═══════════════════════════════════════════════════════════════════════════

  setFullScreen = (fullscreen: boolean): void => {
    pipe(
      logger.debug("setFullScreen:", fullscreen),
      IO.tap(() =>
        IO.of(() => {
          if (this._fullScreen !== fullscreen) {
            this._fullScreen = fullscreen;
            this.backendSetFullscreen(fullscreen);
            this.onFullScreenChange?.();
          }
        }),
      ),
    )();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Playback Control Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Stop presenting broadcast video.
   * Transitions to STOPPED state (channel remains bound).
   */
  stop = (): void => {
    pipe(
      logger.debug("stop"),
      IO.tap(() =>
        IO.of(() => {
          this.backendStop();
          // Force STOPPED since broadcast stop is explicit
          this.setPlayState(OIPF.DAE.Broadcast.PlayState.STOPPED);
        }),
      ),
    )();
  };

  /**
   * Release the decoder/tuner and all associated resources.
   * Transitions to UNREALIZED state.
   */
  release = (): void => {
    pipe(
      logger.debug("release"),
      IO.tap(() =>
        IO.of(() => {
          this.releasePlayer()();
          this._currentChannel = null;
          this.setPlayState(OIPF.DAE.Broadcast.PlayState.UNREALIZED);
        }),
      ),
    )();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Channel Methods
  // ═══════════════════════════════════════════════════════════════════════════

  getChannelConfig = (): OIPF.DAE.Broadcast.ChannelConfig | null => {
    logger.debug("getChannelConfig")();
    // TODO: Implement channel list management
    return null;
  };

  /**
   * Binds the video/broadcast object to the current channel.
   *
   * This is equivalent to: if(currentChannel) play()
   * - Transitions from UNREALIZED → CONNECTING → PRESENTING
   * - From STOPPED → PRESENTING (restarts presentation)
   */
  bindToCurrentChannel = (): OIPF.DAE.Broadcast.Channel | null =>
    pipe(
      logger.debug("bindToCurrentChannel"),
      IO.map(() => {
        if (this._playState === OIPF.DAE.Broadcast.PlayState.UNREALIZED) {
          return null; // Not broadcast related
        }

        if (this._playState === OIPF.DAE.Broadcast.PlayState.STOPPED) {
          // Channel already bound, just restart presentation
          this.setPlayState(OIPF.DAE.Broadcast.PlayState.CONNECTING);
          this.backendPlay();
          return this._currentChannel;
        }

        // Already presenting or connecting
        return this._currentChannel;
      }),
    )();

  createChannelObject = (
    _idType: OIPF.DAE.Broadcast.ChannelIdType,
    _onidOrDsd?: number | string,
    _tsid?: number,
    _sid?: number,
    _sourceID?: number,
    _ipBroadcastID?: string,
  ): OIPF.DAE.Broadcast.Channel | null => {
    logger.debug("createChannelObject")();
    // TODO: Implement channel creation
    return null;
  };

  /**
   * Requests the terminal to switch to the specified channel.
   *
   * - setChannel(channel) → Transitions CONNECTING → PRESENTING
   * - setChannel(null) → Equivalent to release() → UNREALIZED
   */
  setChannel = (
    channel: OIPF.DAE.Broadcast.Channel | null,
    _trickplay?: boolean,
    _contentAccessDescriptorURL?: string,
    _quiet?: OIPF.DAE.Broadcast.QuietMode,
  ): void => {
    pipe(
      logger.debug("setChannel:", channel?.name ?? "null"),
      IO.tap(() =>
        IO.of(() => {
          if (channel === null) {
            // setChannel(null) is equivalent to release
            this.release();
            return;
          }

          // Bind to the new channel
          this._currentChannel = channel;
          this.setPlayState(OIPF.DAE.Broadcast.PlayState.CONNECTING);

          // TODO FIXME
          const channelUrl = this.#getChannelStreamUrl(channel);

          this.loadSource({ url: channelUrl, type: "video" })();
          this.backendPlay();
        }),
      ),
    )();
  };

  /**
   * Get the stream URL for a channel.
   * In a real implementation, this would interface with the tuner.
   */
  #getChannelStreamUrl = (channel: OIPF.DAE.Broadcast.Channel): string => {
    // TODO: Implement actual channel-to-URL mapping
    return `dvb://${channel.onid ?? 0}.${channel.tsid ?? 0}.${channel.sid ?? 0}`;
  };

  prevChannel = (): void => {
    logger.debug("prevChannel")();
    // TODO: Implement with channel list navigation
  };

  nextChannel = (): void => {
    logger.debug("nextChannel")();
    // TODO: Implement with channel list navigation
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Volume Methods
  // ═══════════════════════════════════════════════════════════════════════════

  setVolume = (volume: number): boolean => {
    this.backendSetVolume(volume);
    return true;
  };

  getVolume = (): number => {
    return this.player.volume;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Component Methods
  // ═══════════════════════════════════════════════════════════════════════════

  getComponents = (_componentType?: number | null): undefined => {
    logger.debug("getComponents")();
    // TODO: Implement component management
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
    _listener: OIPF.DAE.Broadcast.StreamEventListener,
  ): void => {
    logger.debug("addStreamEventListener")();
    // TODO: Implement DSM-CC stream events
  };

  removeStreamEventListener = (
    _targetURL: string,
    _eventName: string,
    _listener: OIPF.DAE.Broadcast.StreamEventListener,
  ): void => {
    logger.debug("removeStreamEventListener")();
    // TODO: Implement
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Protected Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  protected setPlayState = (newState: OIPF.DAE.Broadcast.PlayState): void => {
    if (this._playState !== newState) {
      const oldState = this._playState;
      this._playState = newState;
      logger.debug("PlayState changed:", oldState, "->", newState)();
      this.onPlayStateChange?.(newState);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// State Mapping: Stream → VideoBroadcast
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map stream play state to VideoBroadcast PlayState.
 */
const mapStreamToVideoBroadcast = (state: StreamPlayState): OIPF.DAE.Broadcast.PlayState => {
  switch (state) {
    case StreamPlayState.IDLE:
      return OIPF.DAE.Broadcast.PlayState.UNREALIZED;
    case StreamPlayState.CONNECTING:
    case StreamPlayState.BUFFERING:
      return OIPF.DAE.Broadcast.PlayState.CONNECTING;
    case StreamPlayState.PLAYING:
    case StreamPlayState.PAUSED: // VideoBroadcast doesn't have PAUSED, treat as PRESENTING
      return OIPF.DAE.Broadcast.PlayState.PRESENTING;
    case StreamPlayState.STOPPED:
    case StreamPlayState.FINISHED:
    case StreamPlayState.ERROR:
      return OIPF.DAE.Broadcast.PlayState.STOPPED;
  }
};
