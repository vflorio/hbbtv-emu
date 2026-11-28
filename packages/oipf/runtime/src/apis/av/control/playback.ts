/**
 * A/V Control — playback
 *
 * OIPF DAE §7.14.1 (play states) and §7.14.3.1: `data`, `playState`, `error`, `speed`,
 * `playPosition`, `playTime`, `play()`, `stop()`, `seek()`, and the events
 * `onPlayStateChange`, `onPlaySpeedChanged`, `onPlayPositionChanged`.
 *
 * Reader-style module (ROADMAP D1), same shape as video/broadcast's `channel.ts`:
 * - the object's playback state lives in an injected `IORef`;
 * - `MediaPlayer` is the player that renders `data`;
 * - `PlaybackEvents` notifies the application.
 *
 * Rules:
 * - setting `data` loads nothing: `play()` does. Changing it stops playback (§7.14.1.2,
 *   item 4) and forgets the loaded media;
 * - `play(speed)` plays at the supported speed closest to `speed` (only 0 and 1: a
 *   speed of 0 pauses), always returns `true` and reports the speed (`onPlaySpeedChanged`)
 *   even if it did not change. From stopped, `play(0)` reaches paused (item 1). Since it
 *   returns `true`, at least one `onPlayStateChange` follows (TS 102 796 A.2.5.1): a `play()`
 *   that leaves `playState` as it was (`play(1)` while playing) reports it again;
 * - `stop()` stops and brings `playPosition` back to 0;
 * - `seek(pos)` answers `false` for a position that is not one (negative, past the
 *   end): the application gets `onPlayPositionChanged` either way, with the position
 *   it is at when the seek fails. `playPosition` reads the target as soon as `seek()`
 *   returns. Before the media can seek (stopped, connecting, error) the position is
 *   kept for the next `play()`;
 * - `playState` follows the player while the object plays (connecting, buffering,
 *   playing, paused). Stopped, finished and error leave it only through the
 *   application. A seek while paused does not change it (§7.14.3.1, `seek()`);
 * - the end of the media is finished, with speed 0 (item 6);
 * - `onPlayStateChange` fires only when `playState` actually changes, except after `play()`;
 * - `queue(url)` (TS 102 796 A.2.5.1) holds one item: `false` if one is already queued,
 *   `queue(null)` removes it. With no media playing (stopped, finished, error) the item
 *   plays at once. At the end of the media the object is finished, then `data` is the
 *   queued URL and it plays, at the same speed (no `onPlaySpeedChanged`). `stop()`, a
 *   change of `data` and the error state discard it.
 *
 * Emulator choices the spec leaves open: `play()` with no `data` is an error 5
 * (content not available); the player's errors map to 0 (format), 1 (connection)
 * and 2 (anything else); `error` keeps the last error, also once stopped (A.2.5.1: it is
 * available in the stopped state), and is `undefined` until the first. The object stays in
 * the error state until the application acts: the automatic transition to stopped of some
 * TVs is implementation dependent (A.2.5.1).
 */

import { createLogger } from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { type IORef, newIORef } from "fp-ts/IORef";
import * as RIO from "fp-ts/ReaderIO";
import { match } from "ts-pattern";
import type { VideoStreamError, VideoStreamPlayState } from "../../../subsystems/videoStream";

const logger = createLogger("AVControl:Playback");

type PlayState = OIPF.AV.Control.PlayState;
type ErrorCode = OIPF.AV.Control.ErrorCode;
const { PlayState: S, ErrorCode: E } = OIPF.AV.Control;

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

/** A seek the player has not completed yet; `sent: false` until the media can seek. */
export type PendingSeek = Readonly<{ position: number; sent: boolean }>;

export type PlaybackState = Readonly<{
  data: string;
  playState: PlayState;
  error: ErrorCode | undefined;
  speed: number;
  /** The URL loaded in the player, if any. */
  loaded: string | null;
  /** The loaded media has presented a frame or reached its end: it can seek. */
  ready: boolean;
  seek: PendingSeek | null;
  /** The URL `queue()` holds for when the media ends (TS 102 796 A.2.5.1). */
  queued: string | null;
}>;

/** The player that renders `data`. Positions and durations in milliseconds. */
export type MediaPlayer = Readonly<{
  load: (url: string) => IO.IO<void>;
  play: IO.IO<void>;
  pause: IO.IO<void>;
  /** Pauses and goes back to the start. */
  stop: IO.IO<void>;
  seek: (position: number) => IO.IO<void>;
  /** `undefined` with no media loaded. */
  getPosition: IO.IO<number | undefined>;
  /** `undefined` while unknown, and for live media. */
  getDuration: IO.IO<number | undefined>;
  /** Subscribes to the player's state; returns the unsubscribe function. */
  onStreamStateChange: (listener: (state: VideoStreamPlayState) => void) => () => void;
}>;

export type PlaybackEvents = Readonly<{
  onPlayStateChange: (playState: PlayState) => IO.IO<void>;
  onPlaySpeedChanged: (speed: number) => IO.IO<void>;
  onPlayPositionChanged: (position: number | undefined) => IO.IO<void>;
}>;

export type PlaybackEnv = Readonly<{
  playbackState: IORef<PlaybackState>;
  player: MediaPlayer;
  playbackEvents: PlaybackEvents;
}>;

export const INITIAL_PLAYBACK_STATE: PlaybackState = {
  data: "",
  playState: S.STOPPED,
  error: undefined,
  speed: 0,
  loaded: null,
  ready: false,
  seek: null,
  queued: null,
};

export const createPlaybackEnv = (
  dependencies: Omit<PlaybackEnv, "playbackState">,
  initial: Partial<Pick<PlaybackState, "data">> = {},
): IO.IO<PlaybackEnv> =>
  pipe(
    newIORef<PlaybackState>({ ...INITIAL_PLAYBACK_STATE, ...initial }),
    IO.map((playbackState) => ({ ...dependencies, playbackState })),
  );

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

export const readPlaybackState: RIO.ReaderIO<PlaybackEnv, PlaybackState> = ({ playbackState }) => playbackState.read;

const modify =
  (f: (state: PlaybackState) => PlaybackState): RIO.ReaderIO<PlaybackEnv, void> =>
  ({ playbackState }) =>
    playbackState.modify(f);

const noop: RIO.ReaderIO<PlaybackEnv, void> = RIO.of(undefined);

const withPlayer =
  (f: (player: MediaPlayer) => IO.IO<void>): RIO.ReaderIO<PlaybackEnv, void> =>
  ({ player }) =>
    f(player);

const emit =
  (f: (events: PlaybackEvents) => IO.IO<void>): RIO.ReaderIO<PlaybackEnv, void> =>
  ({ playbackEvents }) =>
    f(playbackEvents);

/** Changes `playState`, notifying the application only if it actually changed. */
export const setPlayState = (playState: PlayState): RIO.ReaderIO<PlaybackEnv, void> =>
  pipe(
    readPlaybackState,
    RIO.flatMap((state) =>
      state.playState === playState
        ? noop
        : pipe(
            RIO.fromIO(logger.debug("playState", state.playState, "->", playState)),
            RIO.flatMap(() => modify((s) => ({ ...s, playState }))),
            RIO.flatMap(() => emit((events) => events.onPlayStateChange(playState))),
          ),
    ),
  );

/** The object is presenting (or about to): the player's state is what it shows. */
const isActive = (playState: PlayState): boolean =>
  playState === S.CONNECTING || playState === S.BUFFERING || playState === S.PLAYING || playState === S.PAUSED;

/** `playPosition`: a seek's target as soon as it is asked, otherwise the player's position. */
export const getPlayPosition: RIO.ReaderIO<PlaybackEnv, number | undefined> = (env) => () => {
  const state = env.playbackState.read();
  if (state.seek !== null) return state.seek.position;
  return state.loaded === null ? undefined : env.player.getPosition();
};

/** `playTime`: unknown until the media is loaded. */
export const getPlayTime: RIO.ReaderIO<PlaybackEnv, number | undefined> = (env) => () =>
  env.playbackState.read().loaded === null ? undefined : env.player.getDuration();

// ─────────────────────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────────────────────

/** Speeds the emulator plays at. */
export const SUPPORTED_SPEEDS: ReadonlyArray<number> = [0, 1];

/** The supported speed closest to `speed`; the slower one on a tie, anything not a number is 1. */
export const closestSpeed = (speed: number): number =>
  Number.isFinite(speed)
    ? SUPPORTED_SPEEDS.reduce((best, candidate) =>
        Math.abs(candidate - speed) < Math.abs(best - speed) ? candidate : best,
      )
    : 1;

const fail = (error: ErrorCode): RIO.ReaderIO<PlaybackEnv, void> =>
  pipe(
    modify((s) => ({ ...s, error, loaded: null, ready: false, seek: null, queued: null })),
    RIO.flatMap(() => setPlayState(S.ERROR)),
  );

/** Media no longer loaded: the next `play()` loads `data` again. */
const forgetMedia = modify((s) => ({ ...s, loaded: null, ready: false, seek: null }));

/** `data = url`. A change stops playback; the media is loaded by the next `play()`. */
export const setData = (url: string): RIO.ReaderIO<PlaybackEnv, void> =>
  pipe(
    readPlaybackState,
    RIO.flatMap((state) =>
      state.data === url
        ? noop
        : pipe(
            RIO.fromIO(logger.debug("data", url)),
            RIO.flatMap(() => (state.loaded === null ? noop : withPlayer((player) => player.stop))),
            RIO.flatMap(() => modify((s) => ({ ...s, data: url, queued: null }))),
            RIO.flatMap(() => forgetMedia),
            RIO.flatMap(() => setPlayState(S.STOPPED)),
          ),
    ),
  );

const loadData = (data: string): RIO.ReaderIO<PlaybackEnv, void> =>
  pipe(
    modify((s) => ({ ...s, loaded: data, ready: false })),
    RIO.flatMap(() => withPlayer((player) => player.load(data))),
  );

const startPlaying: RIO.ReaderIO<PlaybackEnv, void> = pipe(
  readPlaybackState,
  RIO.flatMap((state) =>
    match(state)
      .when(
        (s) => s.loaded !== s.data,
        (s) =>
          pipe(
            setPlayState(S.CONNECTING),
            RIO.flatMap(() => loadData(s.data)),
          ),
      )
      // Paused or playing: the player says when it plays.
      .when(
        (s) => isActive(s.playState),
        () => withPlayer((player) => player.play),
      )
      .otherwise(() =>
        pipe(
          setPlayState(S.CONNECTING),
          RIO.flatMap(() => withPlayer((player) => player.play)),
        ),
      ),
  ),
);

const pausePlaying: RIO.ReaderIO<PlaybackEnv, void> = pipe(
  readPlaybackState,
  RIO.flatMap((state) => (state.loaded === state.data ? withPlayer((player) => player.pause) : loadData(state.data))),
  RIO.flatMap(() => setPlayState(S.PAUSED)),
);

/** `onPlayStateChange` with the current `playState`, even if it did not change. */
const repeatPlayState: RIO.ReaderIO<PlaybackEnv, void> = pipe(
  readPlaybackState,
  RIO.flatMap(({ playState }) => emit((events) => events.onPlayStateChange(playState))),
);

/**
 * `play()` already in the state it leads to: playing at a speed other than 0, paused at
 * speed 0, in error with nothing to play. Elsewhere a change follows, at once or from the
 * player (paused to playing, connecting or buffering to playing or error).
 */
const staysInState = (playState: PlayState, speed: number, data: string): boolean =>
  data === "" ? playState === S.ERROR : playState === (speed === 0 ? S.PAUSED : S.PLAYING);

/**
 * `play(speed)`: always `true` (OIPF DAE Table 11), so it always gives the application a
 * play state change (TS 102 796 A.2.5.1): in the state it already was, the same `playState` again.
 */
export const play = (requested: number): RIO.ReaderIO<PlaybackEnv, boolean> =>
  pipe(
    RIO.fromIO(logger.debug("play", requested)),
    RIO.flatMap(() => readPlaybackState),
    RIO.flatMap((state) => {
      const speed = closestSpeed(requested);
      const repeat = staysInState(state.playState, speed, state.data) ? repeatPlayState : noop;
      const operation =
        state.data === ""
          ? fail(E.CONTENT_NOT_AVAILABLE)
          : pipe(
              modify((s) => ({ ...s, speed })),
              RIO.flatMap(() => (speed === 0 ? pausePlaying : startPlaying)),
            );
      return pipe(
        operation,
        RIO.flatMap(() => repeat),
        RIO.flatMap(() => (state.data === "" ? noop : emit((events) => events.onPlaySpeedChanged(speed)))),
      );
    }),
    RIO.map(() => true),
  );

/** `stop()`: stopped, at position 0. */
export const stop: RIO.ReaderIO<PlaybackEnv, boolean> = pipe(
  RIO.fromIO(logger.debug("stop")),
  RIO.flatMap(() => readPlaybackState),
  RIO.flatMap((state) =>
    state.loaded === null
      ? modify((s) => ({ ...s, seek: null }))
      : pipe(
          withPlayer((player) => player.stop),
          RIO.flatMap(() => modify((s) => ({ ...s, seek: { position: 0, sent: true } }))),
        ),
  ),
  RIO.flatMap(() => modify((s) => ({ ...s, queued: null }))),
  RIO.flatMap(() => setPlayState(S.STOPPED)),
  RIO.map(() => true),
);

/** `data` becomes `url` and plays at `speed`, without passing through stopped. */
const playItem = (url: string, speed: number): RIO.ReaderIO<PlaybackEnv, void> =>
  pipe(
    RIO.fromIO(logger.debug("next item", url)),
    RIO.flatMap(() => readPlaybackState),
    RIO.flatMap((state) =>
      pipe(
        modify((s) => ({ ...s, data: url, speed, queued: null })),
        RIO.flatMap(() => forgetMedia),
        RIO.flatMap(() => startPlaying),
        RIO.flatMap(() => (state.speed === speed ? noop : emit((events) => events.onPlaySpeedChanged(speed)))),
      ),
    ),
  );

/** `queue(url)` (TS 102 796 A.2.5.1): `null` (or nothing) removes the queued item. */
export const queue = (url: string | null | undefined): RIO.ReaderIO<PlaybackEnv, boolean> =>
  pipe(
    RIO.fromIO(logger.debug("queue", url)),
    RIO.flatMap(() => readPlaybackState),
    RIO.flatMap((state) =>
      match({ url, state })
        .when(
          ({ url }) => url === null || url === undefined,
          () =>
            pipe(
              modify((s) => ({ ...s, queued: null })),
              RIO.map(() => true),
            ),
        )
        .when(
          ({ state }) => state.queued !== null,
          () => RIO.of(false),
        )
        // No media playing: the queued item plays at once.
        .when(
          ({ state }) => !isActive(state.playState),
          ({ url }) =>
            pipe(
              playItem(String(url), 1),
              RIO.map(() => true),
            ),
        )
        .otherwise(({ url }) =>
          pipe(
            modify((s) => ({ ...s, queued: String(url) })),
            RIO.map(() => true),
          ),
        ),
    ),
  );

const isPosition = (position: number): boolean => Number.isFinite(position) && position >= 0;

/** `seek(pos)`: `onPlayPositionChanged` follows either way. */
export const seek = (position: number): RIO.ReaderIO<PlaybackEnv, boolean> =>
  pipe(
    RIO.fromIO(logger.debug("seek", position)),
    RIO.flatMap(() => RIO.Do),
    RIO.bind("state", () => readPlaybackState),
    RIO.bind("duration", () => getPlayTime),
    RIO.bind("current", () => getPlayPosition),
    RIO.flatMap(({ state, duration, current }) =>
      !isPosition(position) || (duration !== undefined && position > duration)
        ? pipe(
            emit((events) => events.onPlayPositionChanged(current)),
            RIO.map(() => false),
          )
        : pipe(
            state.ready ? withPlayer((player) => player.seek(position)) : noop,
            RIO.flatMap(() => modify((s) => ({ ...s, seek: { position, sent: s.ready } }))),
            RIO.flatMap(() => emit((events) => events.onPlayPositionChanged(position))),
            RIO.map(() => true),
          ),
    ),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Following the player
// ─────────────────────────────────────────────────────────────────────────────

export const toErrorCode = (error: VideoStreamError): ErrorCode =>
  match(error)
    .with({ _tag: "VideoStreamError/NotSupported" }, () => E.FORMAT_NOT_SUPPORTED)
    .with({ _tag: "VideoStreamError/Network" }, () => E.CONNECTION_ERROR)
    .otherwise(() => E.UNIDENTIFIED);

/** The media presents (paused or playing): a seek asked before it could is sent, one sent is done. */
const presented: RIO.ReaderIO<PlaybackEnv, void> = pipe(
  readPlaybackState,
  RIO.flatMap(({ seek: pending }) =>
    pending !== null && !pending.sent
      ? pipe(
          withPlayer((player) => player.seek(pending.position)),
          RIO.flatMap(() => modify((s) => ({ ...s, ready: true, seek: { ...pending, sent: true } }))),
        )
      : modify((s) => ({ ...s, ready: true, seek: null })),
  ),
);

/** The media element pauses just before it ends (HTML, "reaches the end"): that is not a pause. */
const atEnd: RIO.ReaderIO<PlaybackEnv, boolean> = ({ player }) =>
  pipe(
    IO.Do,
    IO.bind("position", () => player.getPosition),
    IO.bind("duration", () => player.getDuration),
    IO.map(({ position, duration }) => position !== undefined && duration !== undefined && position >= duration),
  );

const followPresenting = (playing: boolean): RIO.ReaderIO<PlaybackEnv, void> =>
  pipe(
    presented,
    RIO.flatMap(() => readPlaybackState),
    RIO.flatMap(({ playState, speed }) =>
      match({ active: isActive(playState), speed, playing, playState })
        .with({ active: false }, () => noop)
        // The application paused: the player follows.
        .with({ speed: 0, playing: true }, () => withPlayer((player) => player.pause))
        .with({ speed: 0 }, () => setPlayState(S.PAUSED))
        .with({ playing: true }, () => setPlayState(S.PLAYING))
        // Loaded, or seeked, while the application asks to play.
        .with({ playState: S.CONNECTING }, { playState: S.BUFFERING }, () => withPlayer((player) => player.play))
        // Paused by someone else (the browser), or by the end of the media, which comes next.
        .otherwise(() =>
          pipe(
            atEnd,
            RIO.flatMap((end) => (end ? noop : setPlayState(S.PAUSED))),
          ),
        ),
    ),
  );

/** The player changed state: `playState` follows it while the object plays. */
export const followStream = (stream: VideoStreamPlayState): RIO.ReaderIO<PlaybackEnv, void> =>
  pipe(
    readPlaybackState,
    RIO.flatMap((state) =>
      match(stream)
        .with({ _tag: "Playing" }, () => followPresenting(true))
        .with({ _tag: "Paused" }, () => followPresenting(false))
        .with({ _tag: "Buffering" }, () =>
          state.playState === S.PLAYING && state.ready ? setPlayState(S.BUFFERING) : noop,
        )
        .with({ _tag: "Finished" }, () =>
          match(state)
            .when(
              (s) => !isActive(s.playState),
              () => noop,
            )
            // Finished, then the queued item, at the same speed (TS 102 796 A.2.5.1).
            .when(
              (s) => s.queued !== null,
              (s) =>
                pipe(
                  modify((current) => ({ ...current, ready: true, seek: null })),
                  RIO.flatMap(() => setPlayState(S.FINISHED)),
                  RIO.flatMap(() => playItem(String(s.queued), s.speed)),
                ),
            )
            .otherwise(() =>
              pipe(
                modify((s) => ({ ...s, ready: true, seek: null, speed: 0 })),
                RIO.flatMap(() => setPlayState(S.FINISHED)),
                RIO.flatMap(() => emit((events) => events.onPlaySpeedChanged(0))),
              ),
            ),
        )
        .with({ _tag: "Error" }, ({ error }) => (isActive(state.playState) ? fail(toErrorCode(error)) : noop))
        .with({ _tag: "Idle" }, { _tag: "Connecting" }, { _tag: "Stopped" }, () => noop)
        .exhaustive(),
    ),
  );

/** The object follows its player. Returns the effect that stops following it. */
export const startPlayback: RIO.ReaderIO<PlaybackEnv, IO.IO<void>> = (env) => () => {
  const unsubscribe = env.player.onStreamStateChange((stream) => followStream(stream)(env)());
  return unsubscribe;
};

/**
 * Applies external state (settings UI, scenario). `data` as the application sets it;
 * `playState`, `error` and `speed` are written as they are, without notifying the
 * application (as video/broadcast's `playState`).
 */
export const applyPlaybackState = (
  patch: Partial<Pick<PlaybackState, "data" | "playState" | "error" | "speed">>,
): RIO.ReaderIO<PlaybackEnv, void> =>
  pipe(
    patch.data === undefined ? noop : setData(patch.data),
    RIO.flatMap(() =>
      modify((s) => ({
        ...s,
        playState: patch.playState ?? s.playState,
        error: patch.error ?? s.error,
        speed: patch.speed ?? s.speed,
      })),
    ),
  );
