import { type ClassType, createLogger } from "@hbb-emu/core";
import { DEFAULT_BROADCAST_PLAY_STATE, OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { getChannelRegistry } from "../../providers";
import type { ObjectVideoStream } from "../../providers/videoStream/objectVideoStream";

const logger = createLogger("VideoBroadcast:Channel");

export interface ChannelAPI {
  // State
  currentChannel: OIPF.DAE.Broadcast.VideoBroadcast["currentChannel"];
  _currentChannel: OIPF.DAE.Broadcast.VideoBroadcast["currentChannel"];
  playState: OIPF.DAE.Broadcast.VideoBroadcast["playState"];
  _playState: OIPF.DAE.Broadcast.VideoBroadcast["playState"];
  // Events
  onChannelChangeSucceeded: OIPF.DAE.Broadcast.VideoBroadcast["onChannelChangeSucceeded"];
  onChannelChangeError: OIPF.DAE.Broadcast.VideoBroadcast["onChannelChangeError"];
  onPlayStateChange: OIPF.DAE.Broadcast.VideoBroadcast["onPlayStateChange"];
  // Methods
  bindToCurrentChannel: OIPF.DAE.Broadcast.VideoBroadcast["bindToCurrentChannel"];
  setChannel: OIPF.DAE.Broadcast.VideoBroadcast["setChannel"];
  stop: OIPF.DAE.Broadcast.VideoBroadcast["stop"];
  release: OIPF.DAE.Broadcast.VideoBroadcast["release"];
  prevChannel: OIPF.DAE.Broadcast.VideoBroadcast["prevChannel"];
  nextChannel: OIPF.DAE.Broadcast.VideoBroadcast["nextChannel"];
  getChannelConfig: OIPF.DAE.Broadcast.VideoBroadcast["getChannelConfig"];
  createChannelObject: OIPF.DAE.Broadcast.VideoBroadcast["createChannelObject"];
  // Internal Methods
  setPlayState: (newState: OIPF.DAE.Broadcast.PlayState) => void;
}

export const WithChannelAPI = <T extends ClassType<ObjectVideoStream>>(Base: T) =>
  class extends Base implements ChannelAPI {
    _playState: OIPF.DAE.Broadcast.PlayState = DEFAULT_BROADCAST_PLAY_STATE;
    _currentChannel: OIPF.DAE.Broadcast.Channel | null = null;

    get currentChannel(): OIPF.DAE.Broadcast.Channel | null {
      return this._currentChannel;
    }

    get playState(): OIPF.DAE.Broadcast.PlayState {
      return this._playState;
    }

    onPlayStateChange: OIPF.DAE.Broadcast.OnPlayStateChangeHandler | null = null;
    onChannelChangeError: OIPF.DAE.Broadcast.OnChannelChangeErrorHandler | null = null;
    onChannelChangeSucceeded: OIPF.DAE.Broadcast.OnChannelChangeSucceededHandler | null = null;

    bindToCurrentChannel = (): OIPF.DAE.Broadcast.Channel | null => {
      logger.debug("bindToCurrentChannel", this._playState, this._currentChannel)();

      if (this._playState === OIPF.DAE.Broadcast.PlayState.STOPPED) {
        // Channel already bound, just restart presentation
        this.setPlayState(OIPF.DAE.Broadcast.PlayState.CONNECTING);
        this.backendPlay();
        return this._currentChannel;
      }

      return this._currentChannel;
    };

    // setChannel(null) is equivalent to release()
    setChannel = (
      channel: OIPF.DAE.Broadcast.Channel | null,
      _trickplay?: boolean,
      _contentAccessDescriptorURL?: string,
      _quiet?: OIPF.DAE.Broadcast.QuietMode,
    ): void => {
      if (channel === null) {
        // setChannel(null) is equivalent to release
        this.release();
        return;
      }

      // Bind to the new channel
      this._currentChannel = channel;
      this.setPlayState(OIPF.DAE.Broadcast.PlayState.CONNECTING);

      const channelUrl = this.#getChannelStreamUrl(channel);

      if (!channelUrl) {
        // Channel URL could not be resolved - trigger error
        this.setPlayState(OIPF.DAE.Broadcast.PlayState.STOPPED);
        this.onChannelChangeError?.(channel, OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNKNOWN_CHANNEL);
        return;
      }

      this.loadSource({ url: channelUrl, type: "video", loop: true, autoPlay: true, muted: true })();
    };

    stop = (): void => {
      pipe(
        logger.debug("stop"),
        IO.flatMap(() =>
          IO.of(() => {
            this.backendStop();
            // Force STOPPED since broadcast stop is explicit
            this.setPlayState(OIPF.DAE.Broadcast.PlayState.STOPPED);
          })(),
        ),
      )();
    };

    release = (): void => {
      pipe(
        logger.debug("release"),
        IO.flatMap(() =>
          IO.of(() => {
            this.releasePlayer()();
            // FIXME!
            //this._currentChannel = null;
            this.setPlayState(OIPF.DAE.Broadcast.PlayState.UNREALIZED);
          })(),
        ),
      )();
    };

    #getChannelStreamUrl = (channel: OIPF.DAE.Broadcast.Channel): string | null => {
      const registry = getChannelRegistry();
      if (!registry) {
        logger.warn("Channel registry not initialized")();
        return null;
      }

      const resolution = registry.resolveChannel(channel)();
      if (!resolution) {
        logger.warn("Could not resolve channel to URL:", channel.name)();
        return null;
      }

      return resolution.url;
    };

    setPlayState = (newState: OIPF.DAE.Broadcast.PlayState): void => {
      if (this._playState !== newState) {
        const oldState = this._playState;
        this._playState = newState;
        logger.debug("PlayState changed:", oldState, "->", newState)();
        this.onPlayStateChange?.(newState);
      }
    };

    prevChannel = (): void => {
      logger.debug("prevChannel")();
      // TODO: Implement with channel list navigation
    };

    nextChannel = (): void => {
      logger.debug("nextChannel")();
      // TODO: Implement with channel list navigation
    };

    getChannelConfig = (): OIPF.DAE.Broadcast.ChannelConfig | null => {
      logger.debug("getChannelConfig")();
      // TODO: Implement channel list management
      return null;
    };

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
  };
