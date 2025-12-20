import { type ClassType, createLogger } from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RIO from "fp-ts/ReaderIO";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import { type ChannelRegistryEnv, resolveChannel } from "../../../subsystems/channelRegistry";
import type {
  PlayerEvent,
  PlayerEventListener,
  PlayerPlayState,
  VideoStreamEnv,
  VideoStreamSource,
} from "../../../subsystems/videoStream";
import { VideoStreamService } from "../../../subsystems/videoStream";
import type { VideoBroadcastEnv } from ".";

const logger = createLogger("VideoBroadcast:Channel");

// API

export interface ChannelAPI {
  // State
  currentChannel: OIPF.DAE.Broadcast.VideoBroadcast["currentChannel"];
  _currentChannel: OIPF.DAE.Broadcast.VideoBroadcast["currentChannel"];
  playState: OIPF.DAE.Broadcast.VideoBroadcast["playState"];
  _playState: OIPF.DAE.Broadcast.VideoBroadcast["playState"];
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

export const WithChannel = <T extends ClassType<VideoBroadcastEnv>>(Base: T) =>
  class extends Base implements ChannelAPI {
    #withChannelEnv = {
      ...this.env,
      ...createChannelEnv(this),
    };

    _playState: OIPF.DAE.Broadcast.PlayState = this.env.defaults.playState;
    _currentChannel: OIPF.DAE.Broadcast.Channel | null = null;

    get currentChannel(): OIPF.DAE.Broadcast.Channel | null {
      return this._currentChannel;
    }

    get playState(): OIPF.DAE.Broadcast.PlayState {
      return this._playState;
    }

    setChannel = (
      channel: OIPF.DAE.Broadcast.Channel | null,
      _trickplay?: boolean,
      _contentAccessDescriptorURL?: string,
      _quiet?: OIPF.DAE.Broadcast.QuietMode,
    ): void => {
      pipe(
        TE.Do,
        TE.tapIO(() => logger.debug("setChannel", channel)),
        TE.flatMap(() => setChannel(channel)(this.#withChannelEnv)),
        TE.match(
          (error) =>
            channel
              ? this.env.eventHandlers.onChannelChangeError(channel as OIPF.DAE.Broadcast.Channel, error)
              : undefined,
          IO.of(undefined),
        ),
      )();
    };

    bindToCurrentChannel = bindToCurrentChannel(this.#withChannelEnv);

    stop = stop(this.#withChannelEnv);

    release = release(this.#withChannelEnv);

    setPlayState = (newState: OIPF.DAE.Broadcast.PlayState): void => {
      if (this._playState !== newState) {
        const oldState = this._playState;
        this._playState = newState;
        logger.debug("PlayState changed:", oldState, "->", newState)();
        this.env.eventHandlers.onPlayStateChange(newState);
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
  getPlayState: () => OIPF.DAE.Broadcast.PlayState;
  getCurrentChannel: () => OIPF.DAE.Broadcast.Channel | null;
  setPlayState: (state: OIPF.DAE.Broadcast.PlayState) => IO.IO<void>;
  setCurrentChannel: (channel: OIPF.DAE.Broadcast.Channel | null) => IO.IO<void>;
  onChannelChangeError: (
    channel: OIPF.DAE.Broadcast.Channel,
    errorCode: OIPF.DAE.Broadcast.ChannelChangeErrorCode,
  ) => void;
};

export type ChannelVideoStreamEnv = {
  // Element
  videoElement: HTMLVideoElement;
  // Playback
  play: TE.TaskEither<Error, void>;
  stop: IO.IO<void>;
  destroy: IO.IO<void>;
  loadSource: (source: VideoStreamSource) => IO.IO<void>;
  // Display
  setSize: (width: number, height: number) => IO.IO<void>;
  setFullscreen: (fullscreen: boolean) => IO.IO<void>;
  // Volume
  setVolume: (volume: number) => IO.IO<void>;
  setMuted: (muted: boolean) => IO.IO<void>;
  getVolume: IO.IO<number>;
  // Events
  onStreamStateChange: (listener: (state: PlayerPlayState, previousState: PlayerPlayState) => void) => () => void;
};

export const createChannelEnv = (instance: ChannelAPI & VideoBroadcastEnv): ChannelEnv => ({
  getPlayState: () => instance.playState,
  getCurrentChannel: () => instance.currentChannel,
  setPlayState: (state) => () => {
    instance.setPlayState(state);
  },
  setCurrentChannel: (channel) => () => {
    instance._currentChannel = channel;
    instance.env.onCurrentChannelChange(channel);
    instance.env.streamEventScheduler.setCurrentChannel(channel)();
  },
  onChannelChangeError: (channel, errorCode) => {
    instance.env.eventHandlers.onChannelChangeError(channel, errorCode);
  },
});

export const createChannelVideoStreamEnv = (videoStreamEnv: VideoStreamEnv): ChannelVideoStreamEnv => {
  const stream = new VideoStreamService(videoStreamEnv);

  return {
    // Element
    videoElement: stream.videoElement,

    // Playback
    play: stream.play(),
    stop: stream.stop(),
    destroy: stream.release(),
    loadSource: (source) => stream.loadSource(source),

    // Display
    setSize: (width, height) => stream.setSize(width, height),
    setFullscreen: (fullscreen) => stream.setFullscreen(fullscreen),

    // Volume
    setVolume: (volume) => stream.setVolume(volume),
    setMuted: (muted) => stream.setMuted(muted),
    getVolume: () => Math.round(stream.videoElement.volume * 100),

    // Events
    onStreamStateChange: (listener) => {
      const handler: PlayerEventListener<"statechange"> = (event: PlayerEvent<"statechange">) => {
        listener(event.state, event.previousState);
      };

      stream.on("statechange", handler)();
      return () => stream.off("statechange", handler)();
    },
  };
};

// Methods

export const bindToCurrentChannel = pipe(
  RIO.ask<ChannelEnv & ChannelRegistryEnv & ChannelVideoStreamEnv>(),
  RIO.tapIO((env) => logger.debug("bindToCurrentChannel", env.getPlayState(), env.getCurrentChannel())),
  RIO.flatMap((env) =>
    match(env.getPlayState())
      .with(OIPF.DAE.Broadcast.PlayState.UNREALIZED, () => RIO.of(null))
      .with(OIPF.DAE.Broadcast.PlayState.STOPPED, () =>
        match(env.getCurrentChannel())
          .with(null, () => RIO.of(null))
          .otherwise((channel) =>
            pipe(
              RIO.fromIO(() =>
                pipe(
                  playChannel(channel)(env),
                  TE.match(
                    (error) => env.onChannelChangeError(channel, error),
                    () => undefined,
                  ),
                )(),
              ),
              RIO.as(channel),
            ),
          ),
      )
      .otherwise(() => pipe(RIO.fromIO(env.play), RIO.as(env.getCurrentChannel()))),
  ),
);

export const setChannel = (
  channel: OIPF.DAE.Broadcast.Channel | null,
): RTE.ReaderTaskEither<
  ChannelEnv & ChannelRegistryEnv & ChannelVideoStreamEnv,
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

export const playChannel = (
  channel: OIPF.DAE.Broadcast.Channel,
): RTE.ReaderTaskEither<
  ChannelEnv & ChannelRegistryEnv & ChannelVideoStreamEnv,
  OIPF.DAE.Broadcast.ChannelChangeErrorCode,
  string
> =>
  pipe(
    RTE.ask<ChannelEnv & ChannelRegistryEnv & ChannelVideoStreamEnv>(),
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

export const stop = pipe(
  RIO.ask<ChannelEnv & ChannelVideoStreamEnv>(),
  RIO.tapIO(() => logger.debug("stop")),
  RIO.flatMap((env) =>
    match(env.getPlayState())
      .with(OIPF.DAE.Broadcast.PlayState.STOPPED, () => RIO.Do)
      .otherwise(() =>
        pipe(
          RIO.fromIO(env.stop),
          RIO.flatMapIO(() => env.setPlayState(OIPF.DAE.Broadcast.PlayState.STOPPED)),
        ),
      ),
  ),
);

export const release = pipe(
  RIO.ask<ChannelEnv & ChannelVideoStreamEnv>(),
  RIO.tapIO(() => logger.debug("release")),
  RIO.flatMap((env) =>
    match(env.getPlayState())
      .with(OIPF.DAE.Broadcast.PlayState.UNREALIZED, () => RIO.Do)
      .otherwise(() =>
        pipe(
          RIO.fromIO(env.setPlayState(OIPF.DAE.Broadcast.PlayState.UNREALIZED)),
          RIO.flatMapIO(() => env.destroy),
        ),
      ),
  ),
);
