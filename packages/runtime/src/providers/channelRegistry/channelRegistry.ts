import { createLogger } from "@hbb-emu/core";
import type { ChannelConfig, ExtensionState } from "@hbb-emu/extension-common";
import type { OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";

const logger = createLogger("ChannelRegistry");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Channel triplet for DVB channel identification */
export type ChannelTriplet = Readonly<{
  onid: number;
  tsid: number;
  sid: number;
}>;

/** Result of channel URL resolution */
export type ChannelResolution = Readonly<{
  url: string;
  config: ChannelConfig;
}>;

/** Channel registry interface for resolving channels to stream URLs */
export interface ChannelRegistry {
  /** Get all configured channels */
  readonly channels: ReadonlyArray<ChannelConfig>;
  /** Resolve a channel triplet to a stream URL */
  resolveChannelUrl: (triplet: ChannelTriplet) => IO.IO<ChannelResolution | null>;
  /** Resolve an OIPF Channel to a stream URL */
  resolveChannel: (channel: OIPF.DAE.Broadcast.Channel) => IO.IO<ChannelResolution | null>;
  /** Get the current channel configuration */
  readonly currentChannel: ChannelConfig | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

export type ChannelRegistryEnv = Readonly<{
  channelRegistry: ChannelRegistry;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Global Registry Instance (singleton for access from OIPF objects)
// ─────────────────────────────────────────────────────────────────────────────

let globalChannelRegistry: ChannelRegistry | null = null;

/** Get the global channel registry instance */
export const getChannelRegistry = (): ChannelRegistry | null => globalChannelRegistry;

/** Set the global channel registry instance (called during runtime initialization) */
export const setChannelRegistry =
  (registry: ChannelRegistry): IO.IO<void> =>
  () => {
    globalChannelRegistry = registry;
  };

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

/** Create a channel registry from extension state */
export const createChannelRegistry = (extensionState: ExtensionState): ChannelRegistry => {
  const channels = extensionState.channels;
  const currentChannel = extensionState.currentChannel;

  const matchesTriplet = (config: ChannelConfig, triplet: ChannelTriplet): boolean =>
    config.onid === triplet.onid && config.tsid === triplet.tsid && config.sid === triplet.sid;

  return {
    channels,

    resolveChannelUrl: (triplet) =>
      pipe(
        logger.debug("Resolving channel triplet:", triplet),
        IO.map(() => {
          const config = channels.find((c) => matchesTriplet(c, triplet));
          if (!config) {
            logger.warn("No channel found for triplet:", triplet)();
            return null;
          }
          logger.debug("Resolved channel:", config.name, "->", config.mp4Source)();
          return { url: config.mp4Source, config };
        }),
      ),

    resolveChannel: (channel) =>
      pipe(
        logger.debug("Resolving OIPF channel:", channel.name),
        IO.flatMap(() => {
          if (channel.onid === undefined || channel.tsid === undefined || channel.sid === undefined) {
            logger.warn("Channel missing triplet information")();
            return IO.of(null);
          }
          return createChannelRegistry(extensionState).resolveChannelUrl({
            onid: channel.onid,
            tsid: channel.tsid,
            sid: channel.sid,
          });
        }),
      ),

    currentChannel,
  };
};

/** Create channel registry environment from extension state */
export const createChannelRegistryEnv = (extensionState: ExtensionState): ChannelRegistryEnv => ({
  channelRegistry: createChannelRegistry(extensionState),
});

/** Initialize the channel registry and set the global instance */
export const initializeChannelRegistry: RIO.ReaderIO<ChannelRegistryEnv, void> = (env) =>
  pipe(
    logger.info("Initializing"),
    IO.tap(() => setChannelRegistry(env.channelRegistry)),
    IO.tap(() => logger.info("Initialized with", env.channelRegistry.channels.length, "channels")),
  );
