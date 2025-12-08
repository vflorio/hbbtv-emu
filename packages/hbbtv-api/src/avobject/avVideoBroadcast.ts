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
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { createStatefulMethods, deriveSchema, type OnStateChangeCallback, type Stateful } from "../stateful";

const logger = createLogger("AvVideoBroadcast");

/**
 * Video/Broadcast embedded object implementation.
 *
 * Implements the video/broadcast MIME type for HbbTV applications.
 * Provides channel tuning, EPG access, and component selection.
 */
export class AvVideoBroadcast implements Stateful<VideoBroadcastState> {
  static readonly MIME_TYPE = Broadcast.VideoBroadcast.MIME_TYPE;

  /** The underlying HTML video element used for broadcast presentation */
  protected videoElement: HTMLVideoElement = document.createElement("video");

  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  _playState: Broadcast.VideoBroadcast.PlayState = DEFAULT_BROADCAST_PLAY_STATE;
  _fullScreen = DEFAULT_FULL_SCREEN;
  _width = DEFAULT_VIDEO_WIDTH;
  _height = DEFAULT_VIDEO_HEIGHT;

  // ═══════════════════════════════════════════════════════════════════════════
  // Stateful Interface
  // ═══════════════════════════════════════════════════════════════════════════

  readonly stateful = createStatefulMethods(
    deriveSchema<VideoBroadcastState, AvVideoBroadcast>(VideoBroadcastStateCodec),
    this,
  );

  applyState = (state: Partial<VideoBroadcastState>): IO.IO<void> => this.stateful.applyState(state);

  getState = (): IO.IO<Partial<VideoBroadcastState>> => this.stateful.getState();

  subscribe = (callback: OnStateChangeCallback<VideoBroadcastState>): IO.IO<() => void> =>
    this.stateful.subscribe(callback);

  notifyStateChange = (changedKeys: ReadonlyArray<keyof VideoBroadcastState>): IO.IO<void> =>
    this.stateful.notifyStateChange(changedKeys);

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
      this.videoElement.style.width = `${value}px`;
    }
  }

  get height(): number {
    return this._height;
  }

  set height(value: number) {
    if (!this._fullScreen) {
      this._height = value;
      this.videoElement.style.height = `${value}px`;
    }
  }

  get data(): string {
    return "";
  }

  set data(_value: string) {
    // Setting data property has no effect for video/broadcast
  }

  get currentChannel(): Broadcast.Channel.Channel | null {
    // TODO: Implement channel management
    return null;
  }

  get programmes(): Broadcast.Programme.ProgrammeCollection {
    // TODO: Implement EPG
    return { length: 0, item: () => undefined };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Playback Methods
  // ═══════════════════════════════════════════════════════════════════════════

  setFullScreen = (fullscreen: boolean): void => {
    pipe(
      logger.debug("setFullScreen:", fullscreen),
      IO.tap(() =>
        IO.of(() => {
          if (this._fullScreen !== fullscreen) {
            this._fullScreen = fullscreen;

            if (fullscreen) {
              this.videoElement.requestFullscreen?.().catch((err) => {
                logger.warn("Fullscreen request failed:", err)();
              });
            } else {
              document.exitFullscreen?.().catch((err) => {
                logger.warn("Exit fullscreen failed:", err)();
              });
            }

            this.onFullScreenChange?.();
          }
        }),
      ),
    )();
  };

  stop = (): void => {
    pipe(
      logger.debug("stop"),
      IO.tap(() =>
        IO.of(() => {
          this.videoElement.pause();
          this.setPlayState(Broadcast.VideoBroadcast.PlayState.STOPPED);
        }),
      ),
    )();
  };

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
    this.setPlayState(Broadcast.VideoBroadcast.PlayState.PRESENTING);
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

  setVolume = (volume: number): boolean => {
    const clampedVolume = Math.max(0, Math.min(100, volume));
    this.videoElement.volume = clampedVolume / 100;
    return true;
  };

  getVolume = (): number => {
    return Math.round(this.videoElement.volume * 100);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle Methods
  // ═══════════════════════════════════════════════════════════════════════════

  release = (): void => {
    logger.debug("release")();
    this.stop();
    this.setPlayState(Broadcast.VideoBroadcast.PlayState.UNREALIZED);
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
