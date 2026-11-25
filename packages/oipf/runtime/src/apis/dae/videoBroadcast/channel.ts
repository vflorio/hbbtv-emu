/**
 * video/broadcast — channel
 *
 * OIPF DAE §7.13.1: `currentChannel`, `playState`, `bindToCurrentChannel()`,
 * `setChannel()`, `prevChannel()`, `nextChannel()`, `stop()`, `release()`,
 * `getChannelConfig()`, `createChannelObject()`.
 *
 * Reader-style module (ROADMAP D1), same shape as `./volume.ts` and `./display.ts`:
 * - the object's `playState` and `currentChannel` live in an injected `IORef`;
 * - `BroadcastPlayer` is the stream the object presents;
 * - the TV the object belongs to answers which channel it is tuned to
 *   (`getTunedChannel`) and decides an application's change to another service
 *   (`requestChannelChange`);
 * - `ChannelEvents` notifies the application and the rest of the page.
 *
 * Rules:
 * - an application's `setChannel()` to the service the TV is on only presents it; to
 *   another one the TV decides first, and a channel missing from the lineup fails
 *   before anything changes;
 * - `nextChannel()` / `prevChannel()` are `setChannel()` to the neighbouring channel of
 *   the lineup, cycling at both ends; unrealized, they fail (`NO_CHANNEL_LIST`);
 * - the TV's own tuning (`tuneTo`) asks nobody;
 * - `playState` follows the stream; `onPlayStateChange` fires only when it actually
 *   changes;
 * - `onChannelChangeSucceeded` fires once per channel change, when the new channel's
 *   stream first presents (OIPF DAE §7.13.1.4), not each time the stream resumes;
 * - a new object follows its stream and presents the channel the TV is tuned to
 *   (`startChannel`).
 */

import { type ClassType, createLogger } from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf-api";
import type { PlayerRuntime } from "@hbb-emu/player-runtime";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { type IORef, newIORef } from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import type * as R from "fp-ts/Reader";
import * as RIO from "fp-ts/ReaderIO";
import * as RT from "fp-ts/ReaderTask";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import {
  type ChannelChangeRequest,
  type ChannelRegistryEnv,
  isSameService,
  resolveChannel,
  toBroadcastChannel,
} from "../../../subsystems";
import {
  isStateChangeEvent,
  type VideoStreamPlayState,
  VideoStreamService,
  type VideoStreamSource,
} from "../../../subsystems/videoStream";
import type { VideoBroadcastEnv } from ".";
import { createChannelConfig, neighbourChannel, type Step } from "./channelConfig";

const logger = createLogger("VideoBroadcast:Channel");

type Channel = OIPF.DAE.Broadcast.Channel;
type PlayState = OIPF.DAE.Broadcast.PlayState;
type ChannelChangeErrorCode = OIPF.DAE.Broadcast.ChannelChangeErrorCode;

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

export type ChannelState = Readonly<{
  playState: PlayState;
  currentChannel: Channel | null;
  /** A channel change waits for its stream to present (`onChannelChangeSucceeded`). */
  acquiring: boolean;
}>;

/** The stream the object presents. */
export type BroadcastPlayer = Readonly<{
  loadSource: (source: VideoStreamSource) => IO.IO<void>;
  play: TE.TaskEither<Error, void>;
  stop: IO.IO<void>;
  destroy: IO.IO<void>;
  /** Subscribes to the stream's state; returns the unsubscribe function. */
  onStreamStateChange: (listener: (state: VideoStreamPlayState) => void) => () => void;
}>;

export type ChannelEvents = Readonly<{
  onPlayStateChange: (playState: PlayState) => IO.IO<void>;
  onChannelChangeSucceeded: (channel: Channel) => IO.IO<void>;
  /** `null` only when there was no channel to change from or to (`nextChannel()` with none). */
  onChannelChangeError: (channel: Channel | null, error: ChannelChangeErrorCode) => IO.IO<void>;
  /** The object presents another channel (or none): the rest of the page follows it. */
  onCurrentChannelChange: (channel: Channel | null) => IO.IO<void>;
}>;

export type ChannelEnv = ChannelRegistryEnv &
  Readonly<{
    channelState: IORef<ChannelState>;
    player: BroadcastPlayer;
    /** The channel the TV is tuned to. */
    getTunedChannel: IO.IO<Channel | null>;
    /** Asks the TV before the application changes to another service. */
    requestChannelChange: ChannelChangeRequest;
    channelEvents: ChannelEvents;
  }>;

export const createChannelEnv = (
  dependencies: Omit<ChannelEnv, "channelState">,
  initialPlayState: PlayState = OIPF.DAE.Broadcast.PlayState.UNREALIZED,
): IO.IO<ChannelEnv> =>
  pipe(
    newIORef<ChannelState>({ playState: initialPlayState, currentChannel: null, acquiring: false }),
    IO.map((channelState) => ({ ...dependencies, channelState })),
  );

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

export const readChannelState: RIO.ReaderIO<ChannelEnv, ChannelState> = ({ channelState }) => channelState.read;

export const getPlayState: RIO.ReaderIO<ChannelEnv, PlayState> = pipe(
  readChannelState,
  RIO.map((state) => state.playState),
);

export const getCurrentChannel: RIO.ReaderIO<ChannelEnv, Channel | null> = pipe(
  readChannelState,
  RIO.map((state) => state.currentChannel),
);

const noop: RIO.ReaderIO<ChannelEnv, void> = RIO.of(undefined);

const writePlayState =
  (playState: PlayState): RIO.ReaderIO<ChannelEnv, void> =>
  ({ channelState }) =>
    channelState.modify((state) => ({ ...state, playState }));

/** Changes `playState`, notifying the application only if it actually changed. */
export const setPlayState = (playState: PlayState): RIO.ReaderIO<ChannelEnv, void> =>
  pipe(
    getPlayState,
    RIO.flatMap((current) =>
      current === playState
        ? noop
        : pipe(
            writePlayState(playState),
            RIO.tapIO(() => logger.debug("PlayState changed:", current, "->", playState)),
            RIO.flatMap(() => (env: ChannelEnv) => env.channelEvents.onPlayStateChange(playState)),
          ),
    ),
  );

/** The object presents `channel` (or none). */
const presentChannel =
  (currentChannel: Channel | null): RIO.ReaderIO<ChannelEnv, void> =>
  ({ channelState, channelEvents }) =>
    pipe(
      channelState.modify((state) => ({ ...state, currentChannel })),
      IO.flatMap(() => channelEvents.onCurrentChannelChange(currentChannel)),
    );

/**
 * Applies external state (settings UI, scenario). `currentChannel` reaches the rest
 * of the page as when the object changes channel; `playState` is written as is,
 * without notifying the application.
 */
export const applyChannelState = (
  patch: Partial<Pick<ChannelState, "playState" | "currentChannel">>,
): RIO.ReaderIO<ChannelEnv, void> =>
  pipe(
    patch.playState === undefined ? noop : writePlayState(patch.playState),
    RIO.flatMap(() => (patch.currentChannel === undefined ? noop : presentChannel(patch.currentChannel))),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────────────────────

const reportError =
  (channel: Channel | null, error: ChannelChangeErrorCode): RIO.ReaderIO<ChannelEnv, void> =>
  ({ channelEvents }) =>
    channelEvents.onChannelChangeError(channel, error);

/** Runs a channel change; its failure reaches the application as `onChannelChangeError`. */
const reportingTo =
  (channel: Channel | null) =>
  <A>(change: RTE.ReaderTaskEither<ChannelEnv, ChannelChangeErrorCode, A>): RT.ReaderTask<ChannelEnv, void> =>
    pipe(
      change,
      RTE.matchE(
        (error) => (channel ? RT.fromReaderIO(reportError(channel, error)) : RT.of(undefined)),
        () => RT.of(undefined),
      ),
    );

/** Starts a task without waiting for it: the OIPF methods are synchronous. */
const fork =
  (task: RT.ReaderTask<ChannelEnv, void>): RIO.ReaderIO<ChannelEnv, void> =>
  (env) =>
  () => {
    void task(env)();
  };

const loadStream =
  (url: string): RIO.ReaderIO<ChannelEnv, void> =>
  ({ player }) =>
    player.loadSource({ url, loop: true, autoPlay: true, muted: true });

const stopPlayer: RIO.ReaderIO<ChannelEnv, void> = ({ player }) => player.stop;

const writeAcquiring =
  (acquiring: boolean): RIO.ReaderIO<ChannelEnv, void> =>
  ({ channelState }) =>
    channelState.modify((state) => ({ ...state, acquiring }));

const destroyPlayer: RIO.ReaderIO<ChannelEnv, void> = ({ player }) => player.destroy;

/** Presents `channel`: connecting, then its stream. Fails if the lineup has no stream for it. */
export const playChannel = (channel: Channel): RTE.ReaderTaskEither<ChannelEnv, ChannelChangeErrorCode, string> =>
  pipe(
    RTE.rightReaderIO<ChannelEnv, ChannelChangeErrorCode, void>(setPlayState(OIPF.DAE.Broadcast.PlayState.CONNECTING)),
    RTE.tapIO(() => logger.debug("playChannel", channel)),
    RTE.tapReaderIO(() => presentChannel(channel)),
    RTE.tapReaderIO(() => writeAcquiring(true)),
    RTE.flatMap(() => resolveChannel(channel)),
    RTE.tapReaderIO((resolved) => loadStream(resolved.url)),
    RTE.map((resolved) => resolved.url),
  );

export const stop: RIO.ReaderIO<ChannelEnv, void> = pipe(
  getPlayState,
  RIO.tapIO(() => logger.debug("stop")),
  RIO.flatMap((playState) =>
    playState === OIPF.DAE.Broadcast.PlayState.STOPPED
      ? noop
      : pipe(
          writeAcquiring(false),
          RIO.flatMap(() => stopPlayer),
          RIO.flatMap(() => setPlayState(OIPF.DAE.Broadcast.PlayState.STOPPED)),
        ),
  ),
);

export const release: RIO.ReaderIO<ChannelEnv, void> = pipe(
  getPlayState,
  RIO.tapIO(() => logger.debug("release")),
  RIO.flatMap((playState) =>
    playState === OIPF.DAE.Broadcast.PlayState.UNREALIZED
      ? noop
      : pipe(
          writeAcquiring(false),
          RIO.flatMap(() => setPlayState(OIPF.DAE.Broadcast.PlayState.UNREALIZED)),
          RIO.flatMap(() => destroyPlayer),
        ),
  ),
);

/** Binds the object to `channel` without asking anyone; `null` releases it. */
export const bindTo = (
  channel: Channel | null,
): RTE.ReaderTaskEither<ChannelEnv, ChannelChangeErrorCode, Channel | null> =>
  channel === null ? pipe(RTE.rightReaderIO(release), RTE.as(null)) : pipe(playChannel(channel), RTE.as(channel));

/**
 * The application's `setChannel()`. To the service the TV is on, the object just
 * presents it. To another one, the TV decides first (`requestChannelChange`); once it
 * is on the new channel the object presents it too, unless the TV's own tuning
 * already did. A channel missing from the lineup fails before anything changes.
 */
export const changeChannel = (
  channel: Channel | null,
): RTE.ReaderTaskEither<ChannelEnv, ChannelChangeErrorCode, Channel | null> =>
  channel === null
    ? bindTo(null)
    : pipe(
        resolveChannel(channel),
        RTE.flatMap(({ config }) =>
          RTE.asksReaderTaskEither((env: ChannelEnv) =>
            isSameService(env.getTunedChannel(), channel)
              ? bindTo(channel)
              : pipe(
                  RTE.fromTaskEither(env.requestChannelChange(config)),
                  RTE.flatMap(() => RTE.rightReaderIO(getCurrentChannel)),
                  RTE.flatMap((current) => (isSameService(current, channel) ? RTE.of(current) : bindTo(channel))),
                ),
          ),
        ),
      );

/** `setChannel()`: a failure reaches the application as `onChannelChangeError`. */
export const setChannel = (channel: Channel | null): RT.ReaderTask<ChannelEnv, void> =>
  pipe(
    RT.fromIO(logger.debug("setChannel", channel)),
    RT.flatMap(() => reportingTo(channel)(changeChannel(channel))),
  );

/** The TV changed channel (not the application): the object presents it, nobody is asked. */
export const tuneTo = (channel: Channel): RT.ReaderTask<ChannelEnv, void> => reportingTo(channel)(bindTo(channel));

/** Presents `channel` (none: binds nothing), returning it straight away. */
const presentAgain = (channel: Channel | null): RIO.ReaderIO<ChannelEnv, Channel | null> =>
  channel === null ? RIO.of(null) : pipe(fork(reportingTo(channel)(playChannel(channel))), RIO.as(channel));

/**
 * `bindToCurrentChannel()`: unrealized, it binds to the channel the TV presents
 * (OIPF DAE §7.13.1.3), e.g. after the application released it for on-demand
 * content; stopped, it presents its channel again; connecting or presenting, it
 * resumes the stream. Returns the channel it is bound to.
 */
export const bindToCurrentChannel: RIO.ReaderIO<ChannelEnv, Channel | null> = pipe(
  readChannelState,
  RIO.tapIO(({ playState, currentChannel }) => logger.debug("bindToCurrentChannel", playState, currentChannel)),
  RIO.flatMap(({ playState, currentChannel }) =>
    match(playState)
      .with(OIPF.DAE.Broadcast.PlayState.UNREALIZED, () =>
        pipe(
          RIO.asks((env: ChannelEnv) => env.getTunedChannel()),
          RIO.flatMap(presentAgain),
        ),
      )
      .with(OIPF.DAE.Broadcast.PlayState.STOPPED, () => presentAgain(currentChannel))
      .otherwise(() =>
        pipe(
          fork(({ player }) => T.asUnit(player.play)),
          RIO.as(currentChannel),
        ),
      ),
  ),
);

/** The OIPF play state for the stream's. A stream that buffers is connecting again. */
export const toPlayState = (stream: VideoStreamPlayState): PlayState =>
  match(stream)
    .with({ _tag: "Idle" }, () => OIPF.DAE.Broadcast.PlayState.UNREALIZED)
    .with({ _tag: "Connecting" }, { _tag: "Buffering" }, () => OIPF.DAE.Broadcast.PlayState.CONNECTING)
    .with({ _tag: "Playing" }, { _tag: "Paused" }, () => OIPF.DAE.Broadcast.PlayState.PRESENTING)
    .with({ _tag: "Stopped" }, { _tag: "Finished" }, { _tag: "Error" }, () => OIPF.DAE.Broadcast.PlayState.STOPPED)
    .exhaustive();

/** The stream changed state: `playState` follows, and a pending channel change succeeds once it presents. */
export const followStream = (stream: VideoStreamPlayState): RIO.ReaderIO<ChannelEnv, void> =>
  pipe(
    setPlayState(toPlayState(stream)),
    RIO.flatMap(() => readChannelState),
    RIO.flatMap(({ playState, currentChannel, acquiring }) =>
      acquiring && currentChannel !== null && playState === OIPF.DAE.Broadcast.PlayState.PRESENTING
        ? pipe(
            writeAcquiring(false),
            RIO.flatMap(() => (env: ChannelEnv) => env.channelEvents.onChannelChangeSucceeded(currentChannel)),
          )
        : noop,
    ),
  );

/**
 * A new object: it follows its stream, and presents the channel the TV is tuned to
 * (none with an empty lineup). Returns the effect that stops following the stream.
 */
export const startChannel: RIO.ReaderIO<ChannelEnv, IO.IO<void>> = (env) => () => {
  const unsubscribe = env.player.onStreamStateChange((stream) => followStream(stream)(env)());
  const tuned = env.getTunedChannel();
  if (tuned !== null) void tuneTo(tuned)(env)();
  return unsubscribe;
};

/** The TV's lineup, as OIPF channels, in its order. */
const lineup: RIO.ReaderIO<ChannelEnv, ReadonlyArray<Channel>> = ({ getChannels }) =>
  pipe(
    getChannels,
    // The OIPF Channel object has more members (methods, …) than the emulator fills in.
    IO.map(RA.map((config) => toBroadcastChannel(config) as Channel)),
  );

/** `getChannelConfig()`: the lineup as it is now (it can change while the page runs). */
export const getChannelConfig: RIO.ReaderIO<ChannelEnv, OIPF.DAE.Broadcast.ChannelConfig> = pipe(
  lineup,
  RIO.map(createChannelConfig),
);

/**
 * `nextChannel()` (step 1) / `prevChannel()` (step -1): `setChannel()` to the
 * neighbouring channel of the lineup. Unrealized, or with an empty lineup, the
 * application gets `NO_CHANNEL_LIST`.
 */
export const zap = (step: Step): RT.ReaderTask<ChannelEnv, void> =>
  pipe(
    RT.fromReaderIO(readChannelState),
    RT.tapIO(({ playState, currentChannel }) => logger.debug("zap", step, playState, currentChannel)),
    RT.flatMap(({ playState, currentChannel }) =>
      pipe(
        RT.fromReaderIO(lineup),
        RT.map((channels) =>
          playState === OIPF.DAE.Broadcast.PlayState.UNREALIZED
            ? O.none
            : neighbourChannel(channels, currentChannel, step),
        ),
        RT.flatMap(
          O.match(
            () =>
              RT.fromReaderIO(reportError(currentChannel, OIPF.DAE.Broadcast.ChannelChangeErrorCode.NO_CHANNEL_LIST)),
            (target) => reportingTo(target)(changeChannel(target)),
          ),
        ),
      ),
    ),
  );

/**
 * A channel the application can pass to `setChannel()`, from its DVB triplet: the
 * lineup's one, or a channel the TV does not know (tuning to it fails). `null`
 * without a full triplet (other id types are not supported yet).
 */
export const createChannelObject =
  (
    idType: OIPF.DAE.Broadcast.ChannelIdType,
    onid: number | string | undefined,
    tsid: number | undefined,
    sid: number | undefined,
  ): RIO.ReaderIO<ChannelRegistryEnv, Channel | null> =>
  (env) =>
  () => {
    if (typeof onid !== "number" || typeof tsid !== "number" || typeof sid !== "number") return null;
    const triplet = { onid, tsid, sid };
    return pipe(
      env.getChannels(),
      RA.findFirst((config) => isSameService(config, triplet)),
      O.match((): Partial<Channel> => ({ idType, ...triplet }), toBroadcastChannel),
      // The OIPF Channel object has more members (methods, …) than the emulator fills in.
      (channel) => channel as Channel,
    );
  };

// ─────────────────────────────────────────────────────────────────────────────
// OIPF surface
// ─────────────────────────────────────────────────────────────────────────────

export type ChannelApi = Pick<
  OIPF.DAE.Broadcast.VideoBroadcast,
  | "bindToCurrentChannel"
  | "setChannel"
  | "stop"
  | "release"
  | "prevChannel"
  | "nextChannel"
  | "getChannelConfig"
  | "createChannelObject"
> &
  Readonly<Pick<OIPF.DAE.Broadcast.VideoBroadcast, "currentChannel" | "playState">>;

/** The properties and methods exposed to HbbTV applications: synchronous, as the spec defines them. */
export const channelApi: R.Reader<ChannelEnv, ChannelApi> = (env) => ({
  get currentChannel() {
    return getCurrentChannel(env)();
  },
  get playState() {
    return getPlayState(env)();
  },
  bindToCurrentChannel: () => bindToCurrentChannel(env)(),
  setChannel: (channel: Channel | null) => {
    void setChannel(channel)(env)();
  },
  stop: () => stop(env)(),
  release: () => release(env)(),
  prevChannel: () => {
    void zap(-1)(env)();
  },
  nextChannel: () => {
    void zap(1)(env)();
  },
  getChannelConfig: () => getChannelConfig(env)(),
  createChannelObject: (
    idType: OIPF.DAE.Broadcast.ChannelIdType,
    onidOrDsd?: number | string,
    tsid?: number,
    sid?: number,
  ): Channel | null => {
    logger.debug("createChannelObject", idType, onidOrDsd, tsid, sid)();
    return createChannelObject(idType, onidOrDsd, tsid, sid)(env)();
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Video stream
// ─────────────────────────────────────────────────────────────────────────────

export type ChannelVideoStreamEnv = {
  // Element
  videoElement: HTMLVideoElement;
  // Playback
  play: TE.TaskEither<Error, void>;
  stop: IO.IO<void>;
  destroy: IO.IO<void>;
  loadSource: (source: VideoStreamSource) => IO.IO<void>;
  // Volume
  setVolume: (volume: number) => IO.IO<void>;
  setMuted: (muted: boolean) => IO.IO<void>;
  getVolume: IO.IO<number>;
  // Events
  onStreamStateChange: (
    listener: (state: VideoStreamPlayState, previousState: VideoStreamPlayState) => void,
  ) => () => void;
};

export const createChannelVideoStreamEnv = (playerRuntime?: PlayerRuntime): ChannelVideoStreamEnv => {
  const stream = new VideoStreamService(undefined, playerRuntime);

  // If we have a PlayerRuntime, it will mount automatically in constructor
  // Otherwise, it can be set later via setPlayerRuntime

  return {
    // Element
    videoElement: stream.videoElement,

    // Playback
    play: pipe(
      stream.play(),
      TE.mapLeft((error) => new Error(error.message)),
    ),
    stop: pipe(
      stream.stop(),
      TE.mapLeft((error) => new Error(error.message)),
    ),
    destroy: stream.release(),
    loadSource: (source) =>
      pipe(
        stream.loadSource(source),
        TE.mapLeft((error) => new Error(error.message)),
      ),

    // Volume
    setVolume: (volume) =>
      pipe(
        stream.setVolume(volume),
        TE.mapLeft((error) => new Error(error.message)),
      ),
    setMuted: (muted) =>
      pipe(
        stream.setMuted(muted),
        TE.mapLeft((error) => new Error(error.message)),
      ),
    getVolume: () => Math.round(stream.videoElement.volume * 100),

    // Events
    onStreamStateChange: (listener) => {
      const unsubscribe = stream.subscribe((event) => {
        if (isStateChangeEvent(event)) {
          listener(event.state, event.previousState);
        }
      })();

      return () => unsubscribe();
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Transitional bridge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plugs the Reader module into the VideoBroadcast class while the rest of it is
 * still composed with mixins. `_playState` / `_currentChannel` stay as accessors
 * because the state schema (`deriveSchema` mappings in `./index.ts`) reads and writes
 * them; `tuneTo` is used by the runtime.
 * Remove once VideoBroadcast is ported to Reader composition.
 */
export interface ChannelAPI extends ChannelApi {
  _playState: PlayState;
  _currentChannel: Channel | null;
  /** The TV changed channel (not the application): the object presents it, nobody is asked. */
  tuneTo: (channel: Channel) => void;
}

export const WithChannel = <T extends ClassType<VideoBroadcastEnv>>(Base: T) =>
  class extends Base implements ChannelAPI {
    readonly _channelEnv: ChannelEnv = createChannelEnv(
      {
        getChannels: () => this.env.getChannels(),
        player: this.env,
        getTunedChannel: () => this.env.getTunedChannel(),
        requestChannelChange: (channel) => this.env.requestChannelChange(channel),
        channelEvents: {
          onPlayStateChange: (playState) => () => this.env.eventHandlers.onPlayStateChange(playState),
          onChannelChangeSucceeded: (channel) => () => this.env.eventHandlers.onChannelChangeSucceeded(channel),
          onChannelChangeError: (channel, error) => () => this.env.eventHandlers.onChannelChangeError(channel, error),
          onCurrentChannelChange: (channel) =>
            pipe(
              () => this.env.onCurrentChannelChange(channel),
              IO.flatMap(() => this.env.streamEventScheduler.setCurrentChannel(channel)),
            ),
        },
      },
      this.env.defaults.playState,
    )();

    // Methods only: `channelApi`'s getters would be read once if spread.
    readonly bindToCurrentChannel = channelApi(this._channelEnv).bindToCurrentChannel;
    readonly setChannel = channelApi(this._channelEnv).setChannel;
    readonly stop = channelApi(this._channelEnv).stop;
    readonly release = channelApi(this._channelEnv).release;
    readonly prevChannel = channelApi(this._channelEnv).prevChannel;
    readonly nextChannel = channelApi(this._channelEnv).nextChannel;
    readonly getChannelConfig = channelApi(this._channelEnv).getChannelConfig;
    readonly createChannelObject = channelApi(this._channelEnv).createChannelObject;

    readonly tuneTo = (channel: Channel): void => {
      void tuneTo(channel)(this._channelEnv)();
    };

    get currentChannel(): Channel | null {
      return getCurrentChannel(this._channelEnv)();
    }

    get playState(): PlayState {
      return getPlayState(this._channelEnv)();
    }

    get _currentChannel(): Channel | null {
      return this.currentChannel;
    }

    set _currentChannel(currentChannel: Channel | null) {
      applyChannelState({ currentChannel })(this._channelEnv)();
    }

    get _playState(): PlayState {
      return this.playState;
    }

    set _playState(playState: PlayState) {
      applyChannelState({ playState })(this._channelEnv)();
    }
  };
