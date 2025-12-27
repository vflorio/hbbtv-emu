import { createLogger } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import {
  DEFAULT_BROADCAST_PLAY_STATE,
  DEFAULT_FULL_SCREEN,
  DEFAULT_KEYSET_VALUE,
  DEFAULT_OIPF_CAPABILITIES,
  DEFAULT_OIPF_CONFIGURATION,
  DEFAULT_VIDEO_HEIGHT,
  DEFAULT_VIDEO_WIDTH,
  type HbbTVState,
  type OIPF,
  type OipfCapabilitiesState,
  type OipfConfigurationState,
} from "@hbb-emu/oipf";
import type { PlayerRuntime } from "@hbb-emu/player-runtime";

// ─────────────────────────────────────────────────────────────────────────────
// PlayerRuntime Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factory for creating and destroying PlayerRuntime instances.
 * Used by AVControl objects that need their own runtime instance.
 */
export type PlayerRuntimeFactory = Readonly<{
  /** Creates a new PlayerRuntime instance with configured adapters */
  create: () => PlayerRuntime;
  /** Destroys a PlayerRuntime instance and cleans up resources */
  destroy: (runtime: PlayerRuntime) => void;
}>;

import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { type AVControlVideoDefaults, DEFAULT_AV_CONTROL_VIDEO_DEFAULTS } from "./apis/av/controlVideo";
import { createBindings as createDefaultBindings } from "./apis/bindings";
import {
  type ChannelRegistryEnv,
  createChannelRegistryEnv,
  createCurrentChannelEnv,
  createRemoteControlEnv,
  createStreamEventScheduler,
  createUserAgentEnv,
  dispatchRemoteKey,
  initializeUserAgent,
  type RemoteControlEnv,
  type StreamEventSchedulerApi,
  type UserAgentEnv,
} from "./subsystems";
import { type AnyOipfBinding, createProviderEnv, type GlobalState, ProviderService } from "./subsystems/provider";

const logger = createLogger("Runtime:Service");

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Environment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Environment for creating OIPF bindings.
 * Provides dependencies needed by OIPF objects (VideoBroadcast, ApplicationManager, etc).
 */
export type BindingsEnv = Readonly<{
  /** Channel configuration for VideoBroadcast */
  channelRegistry: ChannelRegistryEnv;
  /**
   * Returns the current channel from the active VideoBroadcast.
   * Used by ApplicationPrivateData.currentChannel.
   */
  getCurrentChannel: () => OIPF.DAE.Broadcast.Channel | null;
  /**
   * Sets the current channel.
   * Called by VideoBroadcast when channel changes.
   */
  setCurrentChannel: (channel: OIPF.DAE.Broadcast.Channel | null) => void;

  /**
   * Returns the shared PlayerRuntime instance for VideoBroadcast.
   * VideoBroadcast uses singleton pattern (only one broadcast at a time).
   */
  getSharedPlayerRuntime: () => PlayerRuntime | null;

  /**
   * Factory for creating PlayerRuntime instances for AVControl.
   * AVControl objects create their own runtime (multiple videos supported).
   */
  playerRuntimeFactory: PlayerRuntimeFactory;

  /** Default keyset bitmask for newly created applications */
  defaultKeysetValue: number;

  /** Default state for Capabilities object */
  defaultOipfCapabilities: OipfCapabilitiesState;

  /** Default state for Configuration object */
  defaultOipfConfiguration: OipfConfigurationState;

  /** Stream event scheduler (DSM-CC) */
  streamEventScheduler: StreamEventSchedulerApi;

  /** Defaults for newly created VideoBroadcast objects */
  defaultVideoBroadcast: Readonly<{
    fullScreen: boolean;
    width: number;
    height: number;
    playState: OIPF.DAE.Broadcast.PlayState;
  }>;

  /** Defaults for newly created A/V Control objects */
  defaultAvControlVideo: AVControlVideoDefaults;
}>;

/**
 * Complete runtime environment.
 * All dependencies needed to initialize and run the HbbTV runtime.
 */
export type RuntimeEnv = Readonly<{
  /** User agent configuration and override capabilities */
  userAgent: UserAgentEnv;
  /** Remote control key dispatching */
  remoteControl: RemoteControlEnv;
  /** Environment for creating bindings */
  bindings: BindingsEnv;
  /** Factory function that creates all OIPF bindings */
  createBindings: (env: BindingsEnv) => ReadonlyArray<AnyOipfBinding>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Runtime API
// ─────────────────────────────────────────────────────────────────────────────

export type Runtime = Readonly<{
  /**
   * Starts the runtime: initializes all subsystems and begins DOM observation.
   */
  start: IO.IO<void>;

  /**
   * Stops the runtime: stops DOM observation.
   */
  stop: IO.IO<void>;

  /**
   * Applies external state to all managed OIPF objects.
   */
  applyState: (state: Partial<HbbTVState>) => IO.IO<void>;

  /**
   * Collects current state from all managed OIPF objects.
   */
  collectState: IO.IO<GlobalState>;

  /**
   * Dispatches a remote control key event.
   */
  dispatchKey: (keyCode: number) => IO.IO<void>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Service
// ─────────────────────────────────────────────────────────────────────────────

export class RuntimeService implements Runtime {
  readonly #env: RuntimeEnv;
  readonly #provider: ProviderService;
  readonly #streamEventScheduler: StreamEventSchedulerApi;
  #playerRuntime: PlayerRuntime | null = null;

  constructor(env: RuntimeEnv) {
    this.#env = env;
    this.#streamEventScheduler = env.bindings.streamEventScheduler;

    // Store the shared PlayerRuntime from env if provided
    this.#playerRuntime = env.bindings.getSharedPlayerRuntime();

    // Create bindings with the environment
    const bindings = env.createBindings(env.bindings);

    // Create provider with bindings
    const providerEnv = createProviderEnv(bindings);
    this.#provider = new ProviderService(providerEnv);
  }

  /**
   * Starts the runtime.
   */
  start: IO.IO<void> = pipe(
    logger.info("Starting"),
    IO.tap(() => initializeUserAgent(this.#env.userAgent)),
    IO.tap(() => this.#streamEventScheduler.start),
    IO.tap(() => this.#provider.start),
    IO.tap(() => logger.info("Runtime")),
  );

  /**
   * Stops the runtime.
   */
  stop: IO.IO<void> = pipe(
    logger.info("Stopping"),
    IO.tap(() => this.#provider.stop),
    IO.tap(() => this.#streamEventScheduler.stop),
    IO.tap(() => logger.info("Stopped")),
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
  collectState: IO.IO<GlobalState> = () => this.#provider.collectState();

  /**
   * Dispatches a remote control key event.
   */
  dispatchKey = (keyCode: number): IO.IO<void> => dispatchRemoteKey(keyCode)(this.#env.remoteControl);

  /**
   * Sets the PlayerRuntime instance.
   * Called by the content script to inject the runtime with configured adapters.
   */
  setPlayerRuntime = (runtime: PlayerRuntime): void => {
    this.#playerRuntime = runtime;
  };

  /**
   * Returns the PlayerRuntime instance if set.
   */
  getPlayerRuntime = (): PlayerRuntime | null => {
    return this.#playerRuntime;
  };

  /**
   * Updates extension-level config (channels and stream event scheduling).
   * Note: OIPF object instances keep the initial channel registry; this currently
   * updates the stream-event scheduler only.
   */
  updateExtensionState = (state: ExtensionState): IO.IO<void> =>
    pipe(
      logger.debug("Updating extension state"),
      IO.tap(() => this.#streamEventScheduler.updateChannels(state.channels)),
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a RuntimeEnv from extension state.
 *
 * @param extensionState - State from the browser extension
 * @param sharedPlayerRuntime - Shared PlayerRuntime instance for VideoBroadcast (singleton)
 * @param playerRuntimeFactory - Factory for creating PlayerRuntime instances for AVControl
 * @param createBindings - Factory function to create all OIPF bindings
 * @returns Complete runtime environment
 */
export const createRuntimeEnv = (
  extensionState: ExtensionState,
  sharedPlayerRuntime?: PlayerRuntime,
  playerRuntimeFactory?: PlayerRuntimeFactory,
  createBindings: (env: BindingsEnv) => ReadonlyArray<AnyOipfBinding> = createDefaultBindings,
): RuntimeEnv => {
  const channelRegistry = createChannelRegistryEnv(extensionState);
  const currentChannelEnv = createCurrentChannelEnv();
  const streamEventScheduler = createStreamEventScheduler(extensionState.channels);

  // Create no-op factory if not provided
  const defaultFactory: PlayerRuntimeFactory = {
    create: () => {
      throw new Error("PlayerRuntimeFactory not configured - cannot create runtime");
    },
    destroy: () => {
      // no-op
    },
  };

  const bindingsEnv: BindingsEnv = {
    // Subsystem environments
    channelRegistry,
    streamEventScheduler,
    // Current channel
    getCurrentChannel: currentChannelEnv.getCurrentChannel,
    setCurrentChannel: currentChannelEnv.setCurrentChannel,
    // PlayerRuntime for VideoBroadcast (singleton)
    getSharedPlayerRuntime: () => sharedPlayerRuntime ?? null,
    // PlayerRuntime factory for AVControl (multiple instances)
    playerRuntimeFactory: playerRuntimeFactory ?? defaultFactory,
    // Defaults
    defaultKeysetValue: DEFAULT_KEYSET_VALUE,
    defaultOipfCapabilities: DEFAULT_OIPF_CAPABILITIES,
    defaultOipfConfiguration: DEFAULT_OIPF_CONFIGURATION,
    defaultVideoBroadcast: {
      fullScreen: DEFAULT_FULL_SCREEN,
      width: DEFAULT_VIDEO_WIDTH,
      height: DEFAULT_VIDEO_HEIGHT,
      playState: DEFAULT_BROADCAST_PLAY_STATE,
    },
    defaultAvControlVideo: DEFAULT_AV_CONTROL_VIDEO_DEFAULTS,
  };

  return {
    userAgent: createUserAgentEnv(extensionState),
    remoteControl: createRemoteControlEnv(),
    bindings: bindingsEnv,
    createBindings,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Convenience handle
// ─────────────────────────────────────────────────────────────────────────────

export type RuntimeHandle = Readonly<{
  /** Applies a partial HbbTV state update */
  updateState: (state: Partial<HbbTVState>) => IO.IO<void>;
  /** Updates extension-level config (channels, scheduling) */
  updateExtensionState: (state: ExtensionState) => IO.IO<void>;
  /** Reads current state from the runtime */
  collectState: IO.IO<GlobalState>;
  /** Dispatches a remote control key event */
  dispatchKey: (keyCode: number) => IO.IO<void>;
  /** Stops DOM observation and tears down runtime services */
  stop: IO.IO<void>;
  /** Sets the PlayerRuntime instance (for player UI integration) */
  setPlayerRuntime: (runtime: PlayerRuntime) => void;
  /** Returns the PlayerRuntime instance (for player UI integration) */
  getPlayerRuntime: () => PlayerRuntime | null;
}>;

/**
 * Starts the runtime and returns a small handle used by the extension.
 */
export const runtime = (env: RuntimeEnv): IO.IO<RuntimeHandle> =>
  pipe(
    IO.of(new RuntimeService(env)),
    IO.tap((service) => service.start),
    IO.map(
      (service): RuntimeHandle => ({
        updateState: service.applyState,
        updateExtensionState: (state) => service.updateExtensionState(state),
        collectState: service.collectState,
        dispatchKey: service.dispatchKey,
        stop: service.stop,
        setPlayerRuntime: service.setPlayerRuntime,
        getPlayerRuntime: service.getPlayerRuntime,
      }),
    ),
  );
