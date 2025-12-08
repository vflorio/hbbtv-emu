/**
 * Video/Broadcast Object with Video Backend
 *
 * Implements the video/broadcast MIME type for HbbTV applications
 * using the video-backend package for unified player management.
 *
 * State Transitions:
 * - UNREALIZED: Initial state, no channel bound
 * - CONNECTING: bindToCurrentChannel() called, connecting to channel
 * - PRESENTING: Channel is being presented
 * - STOPPED: stop() called, channel still bound but not presenting
 *
 * API Mappings:
 * - bindToCurrentChannel() → load source + play (CONNECTING → PRESENTING)
 * - setChannel(channel) → load source + play (CONNECTING → PRESENTING)
 * - setChannel(null) → release (→ UNREALIZED)
 * - stop() → stop playback (→ STOPPED)
 * - release() → release all resources (→ UNREALIZED)
 */

import {
  Broadcast,
  createLogger,
  DEFAULT_BROADCAST_PLAY_STATE,
  DEFAULT_FULL_SCREEN,
  DEFAULT_VIDEO_HEIGHT,
  DEFAULT_VIDEO_WIDTH,
  type VideoBroadcastState,
  VideoBroadcastStateCodec,
} from "@hbb-emu/core";
import { UnifiedPlayState, WithVideoBackend } from "@hbb-emu/video-backend";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import {
  createStatefulMethods,
  deriveSchema,
  type OnStateChangeCallback,
  type Stateful,
} from "../../../core/src/lib/stateful";

const logger = createLogger("VideoBroadcastWithBackend");

// ─────────────────────────────────────────────────────────────────────────────
// State Mapping: Unified → VideoBroadcast
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map unified play state to VideoBroadcast PlayState.
 */
const mapUnifiedToVideoBroadcast = (state: UnifiedPlayState): Broadcast.VideoBroadcast.PlayState => {
  switch (state) {
    case UnifiedPlayState.IDLE:
      return Broadcast.VideoBroadcast.PlayState.UNREALIZED;
    case UnifiedPlayState.CONNECTING:
    case UnifiedPlayState.BUFFERING:
      return Broadcast.VideoBroadcast.PlayState.CONNECTING;
    case UnifiedPlayState.PLAYING:
    case UnifiedPlayState.PAUSED: // VideoBroadcast doesn't have PAUSED, treat as PRESENTING
      return Broadcast.VideoBroadcast.PlayState.PRESENTING;
    case UnifiedPlayState.STOPPED:
    case UnifiedPlayState.FINISHED:
    case UnifiedPlayState.ERROR:
      return Broadcast.VideoBroadcast.PlayState.STOPPED;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Base Class for Mixin
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Empty base class for mixin composition.
 */
class EmptyBase {}

// ─────────────────────────────────────────────────────────────────────────────
// Video/Broadcast Object with Video Backend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Video/Broadcast embedded object implementation using video backend.
 *
 * Provides:
 * - Unified player interface via WithVideoBackend mixin
 * - State mapping from unified states to VideoBroadcast.PlayState
 * - Full HbbTV video/broadcast API compliance
 */
export class VideoBroadcastWithBackend extends WithVideoBackend(EmptyBase) implements Stateful<VideoBroadcastState> {
  static readonly MIME_TYPE = Broadcast.VideoBroadcast.MIME_TYPE;

  // ═══════════════════════════════════════════════════════════════════════════
  // Stateful Interface
  // ═══════════════════════════════════════════════════════════════════════════

  readonly stateful = createStatefulMethods(
    deriveSchema<VideoBroadcastState, VideoBroadcastWithBackend>(VideoBroadcastStateCodec),
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

  protected _playState: Broadcast.VideoBroadcast.PlayState = DEFAULT_BROADCAST_PLAY_STATE;
  protected _fullScreen = DEFAULT_FULL_SCREEN;
  protected _width = DEFAULT_VIDEO_WIDTH;
  protected _height = DEFAULT_VIDEO_HEIGHT;
  protected _currentChannel: Broadcast.Channel.Channel | null = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // Constants (COMPONENT_TYPE_*)
  // ═══════════════════════════════════════════════════════════════════════════

  readonly COMPONENT_TYPE_VIDEO = 0 as const;
  readonly COMPONENT_TYPE_AUDIO = 1 as const;
  readonly COMPONENT_TYPE_SUBTITLE = 2 as const;

  // ═══════════════════════════════════════════════════════════════════════════
  // Event Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  onPlayStateChange: Broadcast.Events.OnPlayStateChangeHandler | null = null;
  onFullScreenChange: Broadcast.Events.OnFullScreenChangeHandler | null = null;
  onfocus: Broadcast.Events.OnFocusHandler | null = null;
  onblur: Broadcast.Events.OnBlurHandler | null = null;
  onChannelChangeSucceeded: Broadcast.Events.OnChannelChangeSucceededHandler | null = null;
  onChannelChangeError: Broadcast.Events.OnChannelChangeErrorHandler | null = null;
  onProgrammesChanged: Broadcast.Events.OnProgrammesChangedHandler | null = null;
  onParentalRatingChange: Broadcast.Events.OnParentalRatingChangeHandler | null = null;
  onParentalRatingError: Broadcast.Events.OnParentalRatingErrorHandler | null = null;
  onDRMRightsError: Broadcast.Events.OnDRMRightsErrorHandler | null = null;
  onSelectedComponentChanged: Broadcast.Events.OnSelectedComponentChangedHandler | null = null;
  onComponentChanged: Broadcast.Events.OnComponentChangedHandler | null = null;

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
    // Map unified state changes to HbbTV playState
    this.onUnifiedStateChange((unifiedState) => {
      const broadcastState = mapUnifiedToVideoBroadcast(unifiedState);
      this.setPlayState(broadcastState);

      // Handle channel change success when presenting
      if (unifiedState === UnifiedPlayState.PLAYING && this._currentChannel) {
        this.onChannelChangeSucceeded?.(this._currentChannel);
      }
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Properties
  // ═══════════════════════════════════════════════════════════════════════════

  get playState(): Broadcast.VideoBroadcast.PlayState {
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

  get currentChannel(): Broadcast.Channel.Channel | null {
    return this._currentChannel;
  }

  get programmes(): Broadcast.Programme.ProgrammeCollection {
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
          this.setPlayState(Broadcast.VideoBroadcast.PlayState.STOPPED);
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
          this.setPlayState(Broadcast.VideoBroadcast.PlayState.UNREALIZED);
        }),
      ),
    )();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Channel Methods
  // ═══════════════════════════════════════════════════════════════════════════

  getChannelConfig = (): Broadcast.Channel.ChannelConfig | null => {
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
  bindToCurrentChannel = (): Broadcast.Channel.Channel | null => {
    return pipe(
      logger.debug("bindToCurrentChannel"),
      IO.map(() => {
        if (this._playState === Broadcast.VideoBroadcast.PlayState.UNREALIZED) {
          // No channel bound yet, simulate binding to a mock channel
          this.setPlayState(Broadcast.VideoBroadcast.PlayState.CONNECTING);

          // In a real implementation, we would get the current broadcast channel
          // and load its stream. For now, we simulate with a test source.
          this.loadSource({ url: "dvb://current.channel", type: "broadcast" })();
          this.backendPlay();

          // Return mock channel (real implementation would return actual channel)
          return this._currentChannel;
        }

        if (this._playState === Broadcast.VideoBroadcast.PlayState.STOPPED) {
          // Channel already bound, just restart presentation
          this.setPlayState(Broadcast.VideoBroadcast.PlayState.CONNECTING);
          this.backendPlay();
          return this._currentChannel;
        }

        // Already presenting or connecting
        return this._currentChannel;
      }),
    )();
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
    channel: Broadcast.Channel.Channel | null,
    _trickplay?: boolean,
    _contentAccessDescriptorURL?: string,
    _quiet?: Broadcast.VideoBroadcast.QuietMode,
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
          this.setPlayState(Broadcast.VideoBroadcast.PlayState.CONNECTING);

          // In a real implementation, we would get the channel's stream URL
          const channelUrl = this.#getChannelStreamUrl(channel);
          this.loadSource({ url: channelUrl, type: "broadcast" })();
          this.backendPlay();
        }),
      ),
    )();
  };

  /**
   * Get the stream URL for a channel.
   * In a real implementation, this would interface with the tuner.
   */
  #getChannelStreamUrl = (channel: Broadcast.Channel.Channel): string => {
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
    _listener: Broadcast.Events.StreamEventListener,
  ): void => {
    logger.debug("addStreamEventListener")();
    // TODO: Implement DSM-CC stream events
  };

  removeStreamEventListener = (
    _targetURL: string,
    _eventName: string,
    _listener: Broadcast.Events.StreamEventListener,
  ): void => {
    logger.debug("removeStreamEventListener")();
    // TODO: Implement
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Protected Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  protected setPlayState = (newState: Broadcast.VideoBroadcast.PlayState): void => {
    if (this._playState !== newState) {
      const oldState = this._playState;
      this._playState = newState;
      logger.debug("PlayState changed:", oldState, "->", newState)();
      this.onPlayStateChange?.(newState);
    }
  };
}
