import {
  type ChannelTriplet as CoreChannelTriplet,
  createLogger,
  matchesChannelTriplet,
  toChannelTriplet,
} from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf-api";
import type { ChannelConfig, ExtensionState } from "@hbb-emu/state";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import { IORef } from "fp-ts/IORef";
import type * as O from "fp-ts/Option";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RA from "fp-ts/ReadonlyArray";

const logger = createLogger("ChannelRegistry");

export type ChannelTriplet = CoreChannelTriplet;

/** Result of channel URL resolution */
export type ChannelResolution = Readonly<{
  url: string;
  config: ChannelConfig;
}>;

/** The channel lineup is read when used: the host can replace it while the page runs. */
export type ChannelRegistryEnv = Readonly<{
  getChannels: IO.IO<ReadonlyArray<ChannelConfig>>;
}>;

export type ChannelRegistry = ChannelRegistryEnv &
  Readonly<{
    setChannels: (channels: ReadonlyArray<ChannelConfig>) => IO.IO<void>;
  }>;

export const createChannelRegistry = (initial: ReadonlyArray<ChannelConfig>): ChannelRegistry => {
  const channels = new IORef<ReadonlyArray<ChannelConfig>>(initial);
  return { getChannels: channels.read, setChannels: channels.write };
};

export const createChannelRegistryEnv = (extensionState: ExtensionState): ChannelRegistry =>
  createChannelRegistry(extensionState.channels);

type ResolveChannelError =
  | {
      _tag: "ChannelNotFound";
    }
  | {
      _tag: "NoStreamUrl";
    };

const channelNotFound: ResolveChannelError = { _tag: "ChannelNotFound" };

const noStreamUrl: ResolveChannelError = { _tag: "NoStreamUrl" };

const matchesTriplet = (triplet: ChannelTriplet) => (config: ChannelConfig) =>
  matchesChannelTriplet(triplet)({ onid: config.onid, tsid: config.tsid, sid: config.sid });

const findChannelByTriplet =
  (triplet: ChannelTriplet) =>
  (channels: ReadonlyArray<ChannelConfig>): O.Option<ChannelConfig> =>
    pipe(channels, RA.findFirst(matchesTriplet(triplet)));

const hasMp4Source = (config: ChannelConfig): config is ChannelConfig & { mp4Source: string } => !!config.mp4Source;

export const resolveChannelUrl = (
  triplet: ChannelTriplet,
): RTE.ReaderTaskEither<ChannelRegistryEnv, ResolveChannelError, ChannelResolution> =>
  pipe(
    RTE.ask<ChannelRegistryEnv>(),
    RTE.flatMap((env) =>
      pipe(
        env.getChannels(),
        findChannelByTriplet(triplet),
        RTE.fromOption(() => channelNotFound),
      ),
    ),
    RTE.flatMap(RTE.fromPredicate(hasMp4Source, () => noStreamUrl)),
    RTE.map((config) => ({
      url: config.mp4Source,
      config,
    })),
    RTE.tapIO((resolution) => logger.debug("Resolved channel URL:", resolution.url)),
  );

export const resolveChannel = (
  channel: OIPF.DAE.Broadcast.Channel,
): RTE.ReaderTaskEither<ChannelRegistryEnv, OIPF.DAE.Broadcast.ChannelChangeErrorCode, ChannelResolution> =>
  pipe(
    channel,
    toChannelTriplet,
    RTE.fromOption(() => OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNKNOWN_CHANNEL),
    RTE.flatMap(resolveChannelUrl),
    RTE.mapLeft(() => OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNKNOWN_CHANNEL),
  );
