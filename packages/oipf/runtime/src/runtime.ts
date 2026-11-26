import { createLogger } from "@hbb-emu/core";
import type { ChannelConfig, ExtensionState } from "@hbb-emu/extension-common";
import {
  DEFAULT_BROADCAST_PLAY_STATE,
  DEFAULT_FULL_SCREEN,
  DEFAULT_KEYSET_VALUE,
  DEFAULT_OIPF_CAPABILITIES,
  DEFAULT_OIPF_CONFIGURATION,
  type HbbTVState,
  OIPF,
  type OipfCapabilitiesState,
  type OipfConfigurationState,
} from "@hbb-emu/oipf-api";
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
import { type AVControlVideoDefaults, DEFAULT_AV_CONTROL_VIDEO_DEFAULTS } from "./apis/av/control";
import { createBindings as createDefaultBindings } from "./apis/bindings";
import { createKeyset } from "./apis/dae/applicationManager/keyset";
import { installObjectFactory, type ObjectFactoryEnv } from "./apis/dae/objectFactory";
import {
  type ChannelChangeRequest,
  type ChannelRegistry,
  type ChannelRegistryEnv,
  createChannelRegistryEnv,
  createCurrentChannelEnv,
  createEmulatorMedia,
  createRemoteControlEnv,
  createStreamEventScheduler,
  createTvVolume,
  createUserAgentEnv,
  DEFAULT_KEY_MAP,
  dispatchRemoteKey,
  type EmulatorMedia,
  ignoreTvKey,
  initializeUserAgent,
  initialTunedChannel,
  installKeyboard,
  installMediaElementVolume,
  isSameService,
  type KeyMap,
  type RemoteControlEnv,
  type StreamEventSchedulerApi,
  type TvVolume,
  tuneAlone,
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
   * Asks the TV before an application changes to another service (`setChannel()`):
   * the host's TV session decides. Without a host the object just tunes.
   */
  requestChannelChange: ChannelChangeRequest;

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

  /** The application's keyset: one per page, as there is one application per page */
  keyset: OIPF.DAE.ApplicationManager.Keyset;

  /** The TV's volume (the user's), in series with every object's */
  tvVolume: TvVolume;

  /** The OIPF objects' videos: their volume is the objects', not the page's `volume` accessor's */
  emulatorMedia: EmulatorMedia;

  /** Default state for Capabilities object */
  defaultOipfCapabilities: OipfCapabilitiesState;

  /** Default state for Configuration object */
  defaultOipfConfiguration: OipfConfigurationState;

  /** Stream event scheduler (DSM-CC) */
  streamEventScheduler: StreamEventSchedulerApi;

  /** Defaults for newly created VideoBroadcast objects */
  defaultVideoBroadcast: Readonly<{
    fullScreen: boolean;
    playState: OIPF.DAE.Broadcast.PlayState;
  }>;

  /** Defaults for newly created A/V Control objects */
  defaultAvControlVideo: AVControlVideoDefaults;
}>;

/** The computer's keyboard, as the remote control (see `installKeyboard`). */
export type KeyboardConfig = Readonly<{
  keyMap: KeyMap;
  /** A key the TV keeps for itself (P+/P-, volume): the host acts on it. */
  pressTvKey: (keyCode: number) => IO.IO<void>;
}>;

/**
 * Complete runtime environment.
 * All dependencies needed to initialize and run the HbbTV runtime.
 */
export type RuntimeEnv = Readonly<{
  /** The channel lineup, replaceable while the page runs (bindings only read it) */
  channelRegistry: ChannelRegistry;
  /** User agent configuration and override capabilities */
  userAgent: UserAgentEnv;
  /** Remote control key dispatching */
  remoteControl: RemoteControlEnv;
  /** The computer's keyboard, as the remote */
  keyboard: KeyboardConfig;
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

  /**
   * Dispatches a remote control key event.
   */
  dispatchKey: (keyCode: number) => IO.IO<void>;

  /**
   * Tunes the TV to a channel (the host's TV session says so).
   */
  tune: (channel: ChannelConfig | null) => IO.IO<void>;

  /**
   * Sets the TV's volume (the host's TV session says so), in series with every
   * object's.
   */
  setTvVolume: (volume: number) => IO.IO<void>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Service
// ─────────────────────────────────────────────────────────────────────────────

type Tunable = Pick<OIPF.DAE.Broadcast.VideoBroadcast, "currentChannel" | "playState"> &
  Readonly<{ tuneTo: (channel: OIPF.DAE.Broadcast.Channel) => void }>;

/** Released by the application: no longer bound to the broadcast. */
const isReleased = (videoBroadcast: Tunable): boolean =>
  videoBroadcast.playState === OIPF.DAE.Broadcast.PlayState.UNREALIZED;

export class RuntimeService implements Runtime {
  readonly #env: RuntimeEnv;
  readonly #provider: ProviderService;
  readonly #streamEventScheduler: StreamEventSchedulerApi;
  readonly #objectFactory: ObjectFactoryEnv;
  #uninstallObjectFactory: IO.IO<void> = IO.of(undefined);
  #uninstallKeyboard: IO.IO<void> = IO.of(undefined);
  #uninstallMediaElementVolume: IO.IO<void> = IO.of(undefined);
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

    this.#objectFactory = {
      document,
      isBindable: (element) => bindings.some((binding) => binding.connector.predicate(element)),
      bindElement: this.#provider.bindElement,
      channelRegistry: env.channelRegistry,
    };
  }

  /**
   * Starts the runtime.
   */
  start = (): IO.IO<void> =>
    pipe(
      logger.info("Starting"),
      IO.tap(() => initializeUserAgent(this.#env.userAgent)),
      IO.tap(() => this.#streamEventScheduler.start()),
      IO.tap(() => this.#provider.start()),
      // After the provider: the objects it creates are bound at once.
      IO.tap(() => () => {
        this.#uninstallObjectFactory = installObjectFactory(window)(this.#objectFactory)();
      }),
      // Before the application's first script, so its key listeners come after.
      IO.tap(() => () => {
        this.#uninstallKeyboard = installKeyboard({
          ...this.#env.remoteControl,
          ...this.#env.keyboard,
          window,
          fromKeyboard: (event) => event.isTrusted,
        })();
      }),
      // Before the application's first script too: its media plays in series with the TV.
      IO.tap(() => () => {
        this.#uninstallMediaElementVolume = installMediaElementVolume({
          window,
          tvVolume: this.#env.bindings.tvVolume,
          emulatorMedia: this.#env.bindings.emulatorMedia,
        })();
      }),
      IO.tap(() => logger.info("Started")),
    );

  /**
   * Stops the runtime.
   */
  stop = (): IO.IO<void> =>
    pipe(
      logger.info("Stopping"),
      IO.tap(() => this.#uninstallObjectFactory),
      IO.tap(() => this.#uninstallKeyboard),
      IO.tap(() => this.#uninstallMediaElementVolume),
      IO.tap(() => this.#provider.stop()),
      IO.tap(() => this.#streamEventScheduler.stop()),
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
  collectState = (): IO.IO<GlobalState> => () => this.#provider.collectState()();

  /**
   * A remote-control key: the application receives it only if its keyset asks for it.
   */
  dispatchKey = (keyCode: number): IO.IO<void> => dispatchRemoteKey(keyCode)(this.#env.remoteControl);

  /** The TV's volume: every object's audio follows it, the applications cannot see it. */
  setTvVolume = (volume: number): IO.IO<void> => this.#env.bindings.tvVolume.set(volume);

  /**
   * Tunes the TV: the current channel the applications read, and every
   * `video/broadcast` on another channel switches to it, as on a TV when the viewer
   * changes channel. Stopped ones too: a stream that failed also ends up stopped.
   * Objects the application released stay so.
   */
  tune = (channel: ChannelConfig | null): IO.IO<void> =>
    pipe(
      IO.of(initialTunedChannel(channel, [])),
      IO.tap((tuned) => () => this.#env.bindings.setCurrentChannel(tuned)),
      IO.tap((tuned) =>
        pipe(
          this.#provider.instancesOf("videoBroadcast"),
          IO.map((instances) => {
            if (tuned === null) return;
            for (const instance of instances as unknown as ReadonlyArray<Tunable>) {
              if (!isReleased(instance) && !isSameService(instance.currentChannel, tuned)) {
                instance.tuneTo(tuned);
              }
            }
          }),
        ),
      ),
      IO.tap(() => logger.debug("Tuned to", channel?.id ?? null)),
      IO.asUnit,
    );

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
   * Applies new host configuration: the channel lineup (for the OIPF objects and the
   * stream-event scheduler) and the user agent.
   */
  updateExtensionState = (state: ExtensionState): IO.IO<void> =>
    pipe(
      logger.debug("Updating extension state"),
      IO.tap(() => this.#env.channelRegistry.setChannels(state.channels)),
      IO.tap(() => this.#streamEventScheduler.updateChannels(state.channels)),
      IO.tap(() =>
        initializeUserAgent({
          ...this.#env.userAgent,
          getUserAgent: () => state.userAgent,
          getHbbTVVersion: () => state.hbbtv.oipfCapabilities?.hbbtvVersion,
        }),
      ),
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
  const currentChannelEnv = createCurrentChannelEnv(
    initialTunedChannel(extensionState.currentChannel, extensionState.channels),
  );
  const streamEventScheduler = createStreamEventScheduler(extensionState.channels);
  // OIPF DAE §7.2.5: a broadcast-related application receives no keys by default.
  const keyset = createKeyset(DEFAULT_KEYSET_VALUE);

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
    requestChannelChange: tuneAlone,
    // PlayerRuntime for VideoBroadcast (singleton)
    getSharedPlayerRuntime: () => sharedPlayerRuntime ?? null,
    // PlayerRuntime factory for AVControl (multiple instances)
    playerRuntimeFactory: playerRuntimeFactory ?? defaultFactory,
    keyset,
    tvVolume: createTvVolume(),
    emulatorMedia: createEmulatorMedia(),
    // Defaults
    defaultOipfCapabilities: DEFAULT_OIPF_CAPABILITIES,
    defaultOipfConfiguration: DEFAULT_OIPF_CONFIGURATION,
    defaultVideoBroadcast: {
      fullScreen: DEFAULT_FULL_SCREEN,
      playState: DEFAULT_BROADCAST_PLAY_STATE,
    },
    defaultAvControlVideo: DEFAULT_AV_CONTROL_VIDEO_DEFAULTS,
  };

  return {
    channelRegistry,
    userAgent: createUserAgentEnv(extensionState),
    remoteControl: createRemoteControlEnv(() => keyset.value),
    keyboard: { keyMap: DEFAULT_KEY_MAP, pressTvKey: ignoreTvKey },
    bindings: bindingsEnv,
    createBindings,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Runtime handle
// ─────────────────────────────────────────────────────────────────────────────

export type RuntimeHandle = Readonly<{
  /** Applies a partial HbbTV state update */
  updateState: (state: Partial<HbbTVState>) => IO.IO<void>;
  /** Updates extension-level config (channels, scheduling) */
  updateExtensionState: (state: ExtensionState) => IO.IO<void>;
  /** Reads current state from the runtime */
  collectState: () => IO.IO<GlobalState>;
  /** Dispatches a remote control key event */
  dispatchKey: (keyCode: number) => IO.IO<void>;
  /** Tunes the TV to a channel (from the host's TV session) */
  tune: (channel: ChannelConfig | null) => IO.IO<void>;
  /** Sets the TV's volume (from the host's TV session) */
  setTvVolume: (volume: number) => IO.IO<void>;
  /** Stops DOM observation and tears down runtime services */
  stop: () => IO.IO<void>;
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
    IO.tap((service) => service.start()),
    IO.map(
      (service): RuntimeHandle => ({
        updateState: service.applyState,
        updateExtensionState: (state) => service.updateExtensionState(state),
        collectState: service.collectState,
        dispatchKey: service.dispatchKey,
        tune: service.tune,
        setTvVolume: service.setTvVolume,
        stop: service.stop,
        setPlayerRuntime: service.setPlayerRuntime,
        getPlayerRuntime: service.getPlayerRuntime,
      }),
    ),
  );
