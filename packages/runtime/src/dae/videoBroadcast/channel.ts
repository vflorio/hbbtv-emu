import { type ClassType, createLogger } from "@hbb-emu/core";
import { DEFAULT_BROADCAST_PLAY_STATE, OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as RIO from "fp-ts/ReaderIO";
import * as RTE from "fp-ts/ReaderTaskEither";
import { match } from "ts-pattern";
import {
  type ChannelRegistryEnv,
  createChannelRegistryEnv,
  type MediaSource,
  type ObjectVideoStream,
  resolveChannel,
} from "../../providers";
import type { VideoBroadcastEnv } from ".";

const logger = createLogger("VideoBroadcast:Channel");

// API

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

// Mixin

export const WithChannel = <T extends ClassType<VideoBroadcastEnv & ObjectVideoStream>>(Base: T) =>
  class extends Base implements ChannelAPI {
    #videoStreamEnv: VideoStreamEnv = {
      destroy: () => this.releasePlayer(),
      loadSource: (source) => () => this.loadSource(source),
      play: () => () => this.player.play(),
      stop: () => () => this.player.stop(),
    };

    #env = {
      ...createChannelEnv(this),
      ...createChannelRegistryEnv(this.extensionState),
      ...this.#videoStreamEnv,
    };

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

    setChannel = (
      channel: OIPF.DAE.Broadcast.Channel | null,
      _trickplay?: boolean,
      _contentAccessDescriptorURL?: string,
      _quiet?: OIPF.DAE.Broadcast.QuietMode,
    ) => setChannel(channel)(this.#env);

    bindToCurrentChannel = bindToCurrentChannel(this.#env);

    stop = stop(this.#env);

    release = release(this.#env);

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

// Environment

export type ChannelEnv = {
  playState: OIPF.DAE.Broadcast.PlayState;
  currentChannel: OIPF.DAE.Broadcast.Channel | null;
  setPlayState: (state: OIPF.DAE.Broadcast.PlayState) => IO.IO<void>;
  setCurrentChannel: (channel: OIPF.DAE.Broadcast.Channel | null) => IO.IO<void>;
  onChannelChangeError: (
    channel: OIPF.DAE.Broadcast.Channel,
    errorCode: OIPF.DAE.Broadcast.ChannelChangeErrorCode,
  ) => void;
};

const createChannelEnv = (instance: ChannelAPI & ObjectVideoStream): ChannelEnv => ({
  playState: instance.playState,
  currentChannel: instance.currentChannel,
  setPlayState: (state) => () => {
    instance._playState = state;
    instance.onPlayStateChange?.(state);
  },
  setCurrentChannel: (channel) => () => {
    instance._currentChannel = channel;
  },
  onChannelChangeError: (channel, errorCode) => {
    instance.onChannelChangeError?.(channel, errorCode);
  },
});

// Methods

const bindToCurrentChannel = pipe(
  RIO.ask<ChannelEnv & VideoStreamEnv>(),
  RIO.tapIO((env) => logger.debug("bindToCurrentChannel", env.playState, env.currentChannel)),
  RIO.flatMap((env) =>
    match(env.playState)
      .with(OIPF.DAE.Broadcast.PlayState.UNREALIZED, () => RIO.of(null))
      .with(OIPF.DAE.Broadcast.PlayState.STOPPED, () => RIO.of(env.currentChannel))
      .otherwise(() =>
        pipe(
          RIO.fromIO(() => env.play),
          RIO.as(env.currentChannel),
        ),
      ),
  ),
);

const setChannel = (
  channel: OIPF.DAE.Broadcast.Channel | null,
): RTE.ReaderTaskEither<
  ChannelEnv & ChannelRegistryEnv & VideoStreamEnv,
  OIPF.DAE.Broadcast.ChannelChangeErrorCode,
  OIPF.DAE.Broadcast.Channel | null
> =>
  pipe(
    RTE.Do,
    RTE.tapIO(() => logger.debug("setChannel", channel)),
    RTE.flatMap(() =>
      match(channel)
        .with(null, () =>
          pipe(
            RTE.of(null),
            RTE.tapReaderIO(() => release),
          ),
        )
        .otherwise((channel) => pipe(playChannel(channel), RTE.as(channel))),
    ),
  );

const playChannel = (
  channel: OIPF.DAE.Broadcast.Channel,
): RTE.ReaderTaskEither<
  ChannelEnv & ChannelRegistryEnv & VideoStreamEnv,
  OIPF.DAE.Broadcast.ChannelChangeErrorCode,
  string
> =>
  pipe(
    RTE.ask<ChannelEnv & ChannelRegistryEnv & VideoStreamEnv>(),
    RTE.tapIO(() => logger.debug("playChannel", channel)),
    RTE.flatMap((env) =>
      pipe(
        RTE.Do,
        RTE.tapIO(() => env.setPlayState(OIPF.DAE.Broadcast.PlayState.CONNECTING)),
        RTE.tapIO(() => env.setCurrentChannel(channel)),
        RTE.flatMap(() => resolveChannel(channel)),
        RTE.tapIO((resolved) =>
          env.loadSource({
            url: resolved.url,
            type: "video",
            loop: true,
            autoPlay: true,
            muted: true,
          }),
        ),
        RTE.map((resolved) => resolved.url),
      ),
    ),
  );

const stop = pipe(
  RIO.ask<ChannelEnv & VideoStreamEnv>(),
  RIO.tapIO(() => logger.debug("stop")),
  RIO.flatMap((env) =>
    match(env.playState)
      .with(OIPF.DAE.Broadcast.PlayState.STOPPED, () => RIO.Do)
      .otherwise(() =>
        pipe(
          RIO.fromIO(env.stop),
          RIO.flatMapIO(() => env.setPlayState(OIPF.DAE.Broadcast.PlayState.STOPPED)),
        ),
      ),
  ),
);

const release = pipe(
  RIO.ask<ChannelEnv & VideoStreamEnv>(),
  RIO.tapIO(() => logger.debug("release")),
  RIO.flatMap((env) =>
    match(env.playState)
      .with(OIPF.DAE.Broadcast.PlayState.UNREALIZED, () => RIO.Do)
      .otherwise(() =>
        pipe(
          RIO.fromIO(env.setPlayState(OIPF.DAE.Broadcast.PlayState.UNREALIZED)),
          RIO.flatMapIO(() => env.destroy),
        ),
      ),
  ),
);

export type VideoStreamEnv = {
  play: IO.IO<void>;
  stop: IO.IO<void>;
  destroy: IO.IO<void>;
  loadSource: (source: MediaSource) => IO.IO<void>;
};
