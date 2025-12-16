import { createLogger } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import type { HbbTVState } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import type { VideoBroadcastPolyfillEnv } from ".";
import {
  createOipfObjectFactoryEnv,
  initializeOipfObjectFactory,
  type OipfObjectFactoryEnv,
} from "./apis/dae/objectFactory";
import { createObjectProviderEnv, initializeObjectProvider, type ObjectProviderEnv } from "./provider";
import { createObjectDefinitions } from "./provider/definitions";
import { applyExternalState } from "./provider/stateful/state";
import {
  type ChannelRegistryEnv,
  createChannelRegistryEnv,
  createStandaloneVideoStreamEnv,
  createUserAgentEnv,
  initializeUserAgent,
  type UserAgentEnv,
} from "./subsystems";

const logger = createLogger("Runtime");

export type RuntimeEnv = UserAgentEnv & OipfObjectFactoryEnv & ObjectProviderEnv & ChannelRegistryEnv;

export type RuntimeHandle = Readonly<{
  /** Apply external state updates to all registered OIPF objects */
  updateState: (state: Partial<HbbTVState>) => IO.IO<void>;
}>;

export const runtime: RIO.ReaderIO<RuntimeEnv, RuntimeHandle> = (env) =>
  pipe(
    logger.info("Initializing"),
    IO.tap(() => initializeUserAgent(env)),
    IO.tap(() => initializeOipfObjectFactory(env)),
    IO.tap(() => initializeObjectProvider(env)),
    IO.map(() => createRuntimeHandle(env)),
    IO.tap(() => logger.info("Initialized")),
  );

const createRuntimeHandle = (env: RuntimeEnv): RuntimeHandle => ({
  updateState: (state) =>
    pipe(
      logger.debug("Updating runtime state"),
      IO.flatMap(() => applyExternalState(state)(env)),
    ),
});

const createFactoryEnv = (channelRegistryEnv: ChannelRegistryEnv): VideoBroadcastPolyfillEnv => ({
  channelRegistry: channelRegistryEnv,
  createVideoStreamEnv: createStandaloneVideoStreamEnv,
});

export const createRuntimeEnv = (extensionState: ExtensionState): RuntimeEnv => {
  const channelRegistryEnv = createChannelRegistryEnv(extensionState);
  const factoryEnv = createFactoryEnv(channelRegistryEnv);
  const objectDefinitions = createObjectDefinitions(factoryEnv);
  return {
    ...createUserAgentEnv(extensionState),
    ...channelRegistryEnv,
    ...createOipfObjectFactoryEnv(),
    ...createObjectProviderEnv(objectDefinitions),
  };
};
