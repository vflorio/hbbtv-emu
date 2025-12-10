import { createLogger } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import {
  createOipfObjectFactoryEnv,
  initializeOipfObjectFactory,
  type OipfObjectFactoryEnv,
} from "./apis/objectFactory";
import { createObjectProviderEnv, initializeObjectProvider, type ObjectProviderEnv } from "./providers";
import { createUserAgentEnv, initializeUserAgent, type UserAgentEnv } from "./providers/userAgent/userAgent";

const logger = createLogger("Runtime");

type RuntimeEnv = UserAgentEnv & OipfObjectFactoryEnv & ObjectProviderEnv;

export const runtime: RIO.ReaderIO<RuntimeEnv, void> = (env) =>
  pipe(
    logger.info("Initializing"),
    IO.tap(() => initializeUserAgent(env)),
    IO.tap(() => initializeOipfObjectFactory(env)),
    IO.tap(() => initializeObjectProvider(env)),
    IO.tap(() => logger.info("Initialized")),
  );

export const createRuntimeDeps = (extensionState: ExtensionState): RuntimeEnv => ({
  ...createUserAgentEnv(extensionState),
  ...createOipfObjectFactoryEnv(),
  ...createObjectProviderEnv(),
});

export class Runtime {
  constructor(extensionState: ExtensionState) {
    runtime(createRuntimeDeps(extensionState))();
  }
}
