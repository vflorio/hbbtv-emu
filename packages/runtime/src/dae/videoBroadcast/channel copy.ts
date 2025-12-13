import { createLogger } from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RIO from "fp-ts/ReaderIO";

const logger = createLogger("VideoBroadcast:Channel");

interface BroadcastEnv {
  // Stato (lettura)
  playState: OIPF.DAE.Broadcast.PlayState;
  currentChannel: OIPF.DAE.Broadcast.Channel | null;

  // Effetti (scrittura/azioni) - avvolti in IO
  setConnecting: IO.IO<void>;
  videoStreamPlay: IO.IO<void>;
  setChannel: IO.IO<void>;
  release: IO.IO<void>;
  setPlayState: (newState: OIPF.DAE.Broadcast.PlayState) => IO.IO<void>;

  releasePlayer: IO.IO<void>;
}

interface ChannelEnv {
  playState: OIPF.DAE.Broadcast.PlayState;
  currentChannel: OIPF.DAE.Broadcast.Channel | null;

  setPlayState: (newState: OIPF.DAE.Broadcast.PlayState) => IO.IO<void>;
  videoStreamPlay: IO.IO<void>;
}

export const bindToCurrentChannel: RIO.ReaderIO<ChannelEnv, OIPF.DAE.Broadcast.Channel | null> = pipe(
  RIO.ask<ChannelEnv>(),
  RIO.tap((env) => RIO.fromIO(logger.debug("bindToCurrentChannel", env.playState, env.currentChannel))),
  RIO.flatMap((env) =>
    pipe(
      env.playState,
      O.fromPredicate((playState) => playState !== OIPF.DAE.Broadcast.PlayState.UNREALIZED),
      O.match(
        () => RIO.of(null),
        (state) =>
          pipe(
            state === OIPF.DAE.Broadcast.PlayState.STOPPED
              ? pipe(
                  RIO.fromIO(env.setPlayState(OIPF.DAE.Broadcast.PlayState.CONNECTING)),
                  RIO.flatMap(() => RIO.fromIO(env.videoStreamPlay)),
                )
              : RIO.Do,
            RIO.map(() => env.currentChannel),
          ),
      ),
    ),
  ),
);

export const release: RIO.ReaderIO<BroadcastEnv, void> = pipe(
  RIO.ask<BroadcastEnv>(),
  RIO.tap(() => RIO.fromIO(logger.debug("release"))),
  RIO.flatMap((env) =>
    pipe(
      env.playState,
      O.fromPredicate((playState) => playState !== OIPF.DAE.Broadcast.PlayState.UNREALIZED),
      O.match(
        () => RIO.Do,
        () =>
          pipe(
            RIO.fromIO(env.setPlayState(OIPF.DAE.Broadcast.PlayState.UNREALIZED)),
            RIO.flatMap(() => RIO.fromIO(env.releasePlayer)),
          ),
      ),
    ),
  ),
);

export const setChannel = (channel: OIPF.DAE.Broadcast.Channel | null): RIO.ReaderIO<BroadcastEnv, void> =>
  pipe(
    RIO.ask<BroadcastEnv>(),
    RIO.tap(() => RIO.fromIO(logger.debug("setChannel", channel))),
    RIO.flatMap((env) =>
      pipe(
        O.fromNullable(channel),
        O.match(
          () => release,
          () =>
            pipe(
              RIO.fromIO(env.setPlayState(OIPF.DAE.Broadcast.PlayState.CONNECTING)),
              RIO.flatMap(() => RIO.fromIO(env.videoStreamPlay)),
            ),
        ),
      ),
    ),
  );
