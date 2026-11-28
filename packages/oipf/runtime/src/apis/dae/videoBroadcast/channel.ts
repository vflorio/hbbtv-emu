/**
 * video/broadcast — channel
 *
 * OIPF DAE §7.13.1: `currentChannel`, `playState`, `bindToCurrentChannel()`,
 * `setChannel()`, `prevChannel()`, `nextChannel()`, `stop()`, `release()`,
 * `getChannelConfig()`, `createChannelObject()`.
 *
 * Reader-style module (ROADMAP D1), same shape as `./volume.ts` and `./display.ts`:
 * - the object's `playState` and `currentChannel` live in an injected `IORef`;
 * - `BroadcastPlayer` is the TV's broadcast, as the object controls it
 *   (`subsystems/broadcastLayer.ts`): the page has one, which the TV presents while no
 *   object does;
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
 * - `setChannel(null)` releases the object at once, as `release()`; `stop()` has no
 *   effect on an unrealized object (§7.13.1.3);
 * - `currentChannel` is the channel the object is bound to (connecting, presenting,
 *   stopped), `null` once unrealized (TS 102 796 A.2.4, on §7.13.7.1). The TV's channel
 *   (`ApplicationPrivateData.currentChannel`) does not change with it;
 * - the TV's own tuning (`tuneTo`) asks nobody;
 * - `playState` follows the stream; `onPlayStateChange` fires only when it actually
 *   changes;
 * - `onChannelChangeSucceeded` fires once per channel change, when the new channel's
 *   stream first presents (OIPF DAE §7.13.1.4), not each time the stream resumes;
 * - a new object is unrealized (OIPF DAE §7.13.1.1): the TV presents the broadcast
 *   until the application binds the object, and `bindToCurrentChannel()` takes it as
 *   it is, presenting at once (Table 8).
 */

import { createLogger } from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { type IORef, newIORef } from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import type * as R from "fp-ts/Reader";
import * as RIO from "fp-ts/ReaderIO";
import * as RT from "fp-ts/ReaderTask";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import { match } from "ts-pattern";
import {
  type BroadcastControl,
  type ChannelChangeRequest,
  type ChannelRegistryEnv,
  isSameService,
  resolveChannel,
  toBroadcastChannel,
} from "../../../subsystems";
import type { VideoStreamPlayState } from "../../../subsystems/videoStream";
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

/** The TV's broadcast, as the object controls it. */
export type BroadcastPlayer = Pick<BroadcastControl, "present" | "bind" | "stop" | "release" | "onStreamStateChange">;

export type ChannelEvents = Readonly<{
  onPlayStateChange: (playState: PlayState) => IO.IO<void>;
  /**
   * The object enters the unrealized state, before the application hears it: what
   * the application changed on it stops having effect (the volume, TS 102 796 §10.2.12).
   */
  onUnrealized: IO.IO<void>;
  /**
   * The object connects to another service than the one it is bound to, before the
   * application hears it is connecting: what it monitored on the old one ends (stream
   * event listeners, TS 102 796 §8.2.1.1).
   */
  onLeaveChannel: IO.IO<void>;
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

/**
 * Unrealized, the object is bound to no channel: its `currentChannel` is `null` (TS 102 796
 * A.2.4, on OIPF DAE §7.13.7.1). The TV stays where it is, so nobody else is told.
 */
const unbind: RIO.ReaderIO<ChannelEnv, void> = ({ channelState }) =>
  channelState.modify((state) => ({ ...state, currentChannel: null }));

/**
 * Changes `playState`, notifying the application only if it actually changed. An
 * object that enters the unrealized state is bound to no channel, and drops what the
 * application changed on it first (`onUnrealized`), so a handler of the change already
 * sees it gone.
 */
export const setPlayState = (playState: PlayState): RIO.ReaderIO<ChannelEnv, void> =>
  pipe(
    getPlayState,
    RIO.flatMap((current) =>
      current === playState
        ? noop
        : pipe(
            writePlayState(playState),
            RIO.tapIO(() => logger.debug("PlayState changed:", current, "->", playState)),
            RIO.flatMap(() =>
              playState === OIPF.DAE.Broadcast.PlayState.UNREALIZED
                ? pipe(
                    unbind,
                    RIO.flatMap(() => (env: ChannelEnv) => env.channelEvents.onUnrealized),
                  )
                : noop,
            ),
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

const presentStream =
  (url: string): RIO.ReaderIO<ChannelEnv, void> =>
  ({ player }) =>
    player.present(url);

const stopPlayer: RIO.ReaderIO<ChannelEnv, void> = ({ player }) => player.stop;

const writeAcquiring =
  (acquiring: boolean): RIO.ReaderIO<ChannelEnv, void> =>
  ({ channelState }) =>
    channelState.modify((state) => ({ ...state, acquiring }));

/** Control of the broadcast goes back to the TV (OIPF DAE Annex H.2). */
const releasePlayer: RIO.ReaderIO<ChannelEnv, void> = ({ player }) => player.release;

/** Bound to another service than `channel`: the object leaves it (`onLeaveChannel`). */
const leaveFor = (channel: Channel): RIO.ReaderIO<ChannelEnv, void> =>
  pipe(
    getCurrentChannel,
    RIO.flatMap((current) =>
      current !== null && !isSameService(current, channel)
        ? (env: ChannelEnv) => env.channelEvents.onLeaveChannel
        : noop,
    ),
  );

/** Presents `channel`: connecting, then its stream. Fails if the lineup has no stream for it. */
export const playChannel = (channel: Channel): RTE.ReaderTaskEither<ChannelEnv, ChannelChangeErrorCode, string> =>
  pipe(
    RTE.rightReaderIO<ChannelEnv, ChannelChangeErrorCode, void>(leaveFor(channel)),
    RTE.tapReaderIO(() => setPlayState(OIPF.DAE.Broadcast.PlayState.CONNECTING)),
    RTE.tapIO(() => logger.debug("playChannel", channel)),
    RTE.tapReaderIO(() => presentChannel(channel)),
    RTE.tapReaderIO(() => writeAcquiring(true)),
    RTE.flatMap(() => resolveChannel(channel)),
    RTE.tapReaderIO((resolved) => presentStream(resolved.url)),
    RTE.map((resolved) => resolved.url),
  );

/**
 * `stop()` (OIPF DAE §7.13.1.3): connecting or presenting, the object stops presenting.
 * Unrealized, it has no effect ("Calling this method from the unrealized state SHALL have
 * no effect"): the TV goes on presenting its broadcast, and the object stays unrealized.
 */
export const stop: RIO.ReaderIO<ChannelEnv, void> = pipe(
  getPlayState,
  RIO.tapIO((playState) => logger.debug("stop", playState)),
  RIO.flatMap((playState) =>
    playState === OIPF.DAE.Broadcast.PlayState.STOPPED || playState === OIPF.DAE.Broadcast.PlayState.UNREALIZED
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
          RIO.flatMap(() => releasePlayer),
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

/**
 * `setChannel(null)` releases the object before it returns, as `release()` does (OIPF DAE
 * Table 8): what the application calls next (`stop()`, `playState`) sees it unrealized.
 */
export const setChannelNow = (channel: Channel | null): RIO.ReaderIO<ChannelEnv, void> =>
  channel === null
    ? pipe(
        RIO.fromIO(logger.debug("setChannel", null)),
        RIO.flatMap(() => release),
      )
    : fork(setChannel(channel));

/** The TV changed channel (not the application): the object presents it, nobody is asked. */
export const tuneTo = (channel: Channel): RT.ReaderTask<ChannelEnv, void> => reportingTo(channel)(bindTo(channel));

/** Presents `channel` (none: binds nothing), returning it straight away. */
const presentAgain = (channel: Channel | null): RIO.ReaderIO<ChannelEnv, Channel | null> =>
  channel === null ? RIO.of(null) : pipe(fork(reportingTo(channel)(playChannel(channel))), RIO.as(channel));

/**
 * No channel to bind to: the application hears the object stays unrealized, even
 * though the state does not change (OIPF DAE §7.13.1.3).
 */
const stayUnrealized: RIO.ReaderIO<ChannelEnv, Channel | null> = pipe(
  (env: ChannelEnv) => env.channelEvents.onPlayStateChange(OIPF.DAE.Broadcast.PlayState.UNREALIZED),
  RIO.as(null),
);

/**
 * Unrealized, the object binds to the channel the TV presents, as it presents it: it is
 * presenting at once, and only `PlayStateChange` tells the application (OIPF DAE Table 8,
 * "the terminal binds the video/broadcast object to the current channel being natively
 * presented"). No channel change happened, so none succeeds.
 */
const bindToPresented = (tuned: Channel): RIO.ReaderIO<ChannelEnv, Channel | null> =>
  pipe(
    (env: ChannelEnv) => env.player.bind,
    RIO.flatMap((bound) =>
      bound
        ? pipe(
            presentChannel(tuned),
            RIO.flatMap(() => writeAcquiring(false)),
            RIO.flatMap(() => setPlayState(OIPF.DAE.Broadcast.PlayState.PRESENTING)),
            RIO.as<Channel | null>(tuned),
          )
        : stayUnrealized,
    ),
  );

/**
 * `bindToCurrentChannel()` (OIPF DAE §7.13.1.3): unrealized, it binds to the channel
 * the TV presents, e.g. at the application's start or after it released the object for
 * on-demand content; stopped, it presents its channel again; connecting or presenting,
 * it has no effect. Returns the channel it is bound to.
 */
export const bindToCurrentChannel: RIO.ReaderIO<ChannelEnv, Channel | null> = pipe(
  readChannelState,
  RIO.tapIO(({ playState, currentChannel }) => logger.debug("bindToCurrentChannel", playState, currentChannel)),
  RIO.flatMap(({ playState, currentChannel }) =>
    match(playState)
      .with(OIPF.DAE.Broadcast.PlayState.UNREALIZED, () =>
        pipe(
          RIO.asks((env: ChannelEnv) => env.getTunedChannel()),
          RIO.flatMap((tuned) => (tuned === null ? stayUnrealized : bindToPresented(tuned))),
        ),
      )
      .with(OIPF.DAE.Broadcast.PlayState.STOPPED, () => presentAgain(currentChannel))
      .otherwise(() => RIO.of(currentChannel)),
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
 * A new object: it follows the stream while it controls it. It starts unrealized (OIPF
 * DAE §7.13.1.1): the TV goes on presenting the broadcast until the application binds
 * it. Returns the effect that stops following the stream.
 */
export const startChannel: RIO.ReaderIO<ChannelEnv, IO.IO<void>> = (env) => () =>
  env.player.onStreamStateChange((stream) => followStream(stream)(env)());

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
  setChannel: (channel: Channel | null) => setChannelNow(channel)(env)(),
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
