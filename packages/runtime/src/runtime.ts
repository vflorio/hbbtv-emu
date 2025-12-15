import { createLogger } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import type { HbbTVState } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import type { FactoryEnv } from ".";
import {
  createOipfObjectFactoryEnv,
  initializeOipfObjectFactory,
  type OipfObjectFactoryEnv,
} from "./apis/objectFactory";
import {
  type ChannelRegistryEnv,
  createChannelRegistryEnv,
  createObjectProviderEnv,
  createStandaloneVideoStreamEnv,
  initializeObjectProvider,
  type ObjectProviderEnv,
} from "./providers";
import { createObjectDefinitions } from "./providers/object/definitions";
import { applyExternalState } from "./providers/object/stateful/state";
import { createUserAgentEnv, initializeUserAgent, type UserAgentEnv } from "./providers/userAgent/userAgent";

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

/** Create runtime handle with state update capabilities */
const createRuntimeHandle = (env: RuntimeEnv): RuntimeHandle => ({
  updateState: (state) =>
    pipe(
      logger.debug("Updating runtime state"),
      IO.flatMap(() => applyExternalState(state)(env)),
    ),
});

/** Create FactoryEnv for object instantiation */
const createFactoryEnv = (channelRegistryEnv: ChannelRegistryEnv): FactoryEnv => ({
  channelRegistry: channelRegistryEnv,
  createVideoStreamEnv: createStandaloneVideoStreamEnv,
});

export const createRuntimeEnv = (extensionState: ExtensionState): RuntimeEnv => {
  // 1. Create base envs
  const channelRegistryEnv = createChannelRegistryEnv(extensionState);
  const factoryEnv = createFactoryEnv(channelRegistryEnv);

  // 2. Create object definitions with env closed over (key step in Reader pattern)
  const objectDefinitions = createObjectDefinitions(factoryEnv);

  // 3. Build complete runtime env
  return {
    ...createUserAgentEnv(extensionState),
    ...channelRegistryEnv,
    ...createOipfObjectFactoryEnv(),
    ...createObjectProviderEnv(objectDefinitions),
  };
};
