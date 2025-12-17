import { createLogger } from "@hbb-emu/core";
import type { ChannelConfig, ExtensionState } from "@hbb-emu/extension-common";
import { OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import type * as O from "fp-ts/Option";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RA from "fp-ts/ReadonlyArray";

const logger = createLogger("ChannelRegistry");

export type ChannelTriplet = Pick<OIPF.DAE.Broadcast.Channel, "onid" | "tsid" | "sid">;

/** Result of channel URL resolution */
export type ChannelResolution = Readonly<{
  url: string;
  config: ChannelConfig;
}>;

export type ChannelRegistryEnv = Readonly<{
  channels: ReadonlyArray<ChannelConfig>;
}>;

export const createChannelRegistryEnv = (extensionState: ExtensionState): ChannelRegistryEnv => ({
  channels: extensionState.channels,
});

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
  config.onid === triplet.onid && config.tsid === triplet.tsid && config.sid === triplet.sid;

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
        env.channels,
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
    resolveChannelUrl({
      onid: channel.onid,
      tsid: channel.tsid,
      sid: channel.sid,
    }),
    RTE.mapLeft(() => OIPF.DAE.Broadcast.ChannelChangeErrorCode.UNKNOWN_CHANNEL),
  );
