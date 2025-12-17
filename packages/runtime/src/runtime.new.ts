import { createLogger } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import type { HbbTVState } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import {
  type ChannelRegistryEnv,
  createChannelRegistryEnv,
  createDefaultVideoStreamEnv,
  createUserAgentEnv,
  initializeUserAgent,
  type UserAgentEnv,
  type VideoStreamEnv,
} from "./subsystems";
import { type AnyOipfBinding, createProviderEnv, type GlobalState, ProviderService } from "./subsystems/provider";

const logger = createLogger("RuntimeService");

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Environment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Environment for creating OIPF bindings.
 * Provides dependencies needed by visual objects (VideoBroadcast, AVControl).
 */
export type BindingsEnv = Readonly<{
  /** Channel configuration for VideoBroadcast */
  channelRegistry: ChannelRegistryEnv;
  /** Factory for creating VideoStream instances */
  createVideoStream: () => VideoStreamEnv;
}>;

/**
 * Complete runtime environment.
 * All dependencies needed to initialize and run the HbbTV runtime.
 */
export type RuntimeEnv = Readonly<{
  /** User agent configuration and override capabilities */
  userAgent: UserAgentEnv;
  /** Environment for creating bindings */
  bindings: BindingsEnv;
  /** Factory function that creates all OIPF bindings */
  createBindings: (env: BindingsEnv) => ReadonlyArray<AnyOipfBinding>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Runtime API
// ─────────────────────────────────────────────────────────────────────────────

export type RuntimeApi = Readonly<{
  /**
   * Starts the runtime: initializes all subsystems and begins DOM observation.
   */
  start: () => IO.IO<void>;

  /**
   * Stops the runtime: stops DOM observation.
   */
  stop: () => IO.IO<void>;

  /**
   * Applies external state to all managed OIPF objects.
   */
  applyState: (state: Partial<HbbTVState>) => IO.IO<void>;

  /**
   * Collects current state from all managed OIPF objects.
   */
  collectState: () => IO.IO<GlobalState>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Service
// ─────────────────────────────────────────────────────────────────────────────

export class RuntimeService implements RuntimeApi {
  readonly #env: RuntimeEnv;
  readonly #provider: ProviderService;

  constructor(env: RuntimeEnv) {
    this.#env = env;

    // Create bindings with the bindings environment
    const bindings = env.createBindings(env.bindings);

    // Create provider with bindings
    const providerEnv = createProviderEnv(bindings);
    this.#provider = new ProviderService(providerEnv);
  }

  /**
   * Starts the runtime.
   */
  start = (): IO.IO<void> =>
    pipe(
      logger.info("Starting runtime"),
      IO.tap(() => initializeUserAgent(this.#env.userAgent)),
      IO.tap(() => this.#provider.start()),
      IO.tap(() => logger.info("Runtime started")),
    );

  /**
   * Stops the runtime.
   */
  stop = (): IO.IO<void> =>
    pipe(
      logger.info("Stopping runtime"),
      IO.tap(() => this.#provider.stop()),
      IO.tap(() => logger.info("Runtime stopped")),
    );

  /**
   * Applies external state to all managed OIPF objects.
   */
  applyState = (state: Partial<HbbTVState>): IO.IO<void> =>
    pipe(
      logger.debug("Applying state"),
      IO.tap(() => this.#provider.applyState(state as GlobalState)),
    );

  /**
   * Collects current state from all managed OIPF objects.
   */
  collectState = (): IO.IO<GlobalState> => this.#provider.collectState();
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a RuntimeEnv from extension state.
 *
 * @param extensionState - State from the browser extension
 * @param createBindings - Factory function to create all OIPF bindings
 * @returns Complete runtime environment
 */
export const createRuntimeEnv = (
  extensionState: ExtensionState,
  createBindings: (env: BindingsEnv) => ReadonlyArray<AnyOipfBinding>,
): RuntimeEnv => {
  const channelRegistry = createChannelRegistryEnv(extensionState);

  return {
    userAgent: createUserAgentEnv(extensionState),
    bindings: {
      channelRegistry,
      createVideoStream: createDefaultVideoStreamEnv,
    },
    createBindings,
  };
};
