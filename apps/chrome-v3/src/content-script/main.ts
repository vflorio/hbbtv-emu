import { createLogger } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import { createRuntimeEnv, type PlayerRuntimeFactory, type RuntimeHandle, runtime } from "@hbb-emu/oipf-runtime";
import { DASHAdapter, HLSAdapter, NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerRuntime, type PlayerRuntimeConfig } from "@hbb-emu/player-runtime";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { App, type Instance } from "./app";
import { mapChannelConfigToOIPFChannel } from "./mappers";
import { PlayerUIService } from "./player-ui";
import { responseError, sendGetState, waitForState } from "./utils";

const logger = createLogger("ContentScript");

/**
 * ContentScript API
 * Exposes content script lifecycle for HbbTV emulator
 */
export type ContentScript = Readonly<{
  start: () => T.Task<void>;
}>;

/**
 * ContentScript Service
 * Manages HbbTV runtime initialization and player UI lifecycle
 */
export class ContentScriptService implements ContentScript {
  private readonly app: Instance;
  private readonly playerUI: PlayerUIService;
  private config: O.Option<ExtensionState> = O.none;
  private runtimeHandle: O.Option<RuntimeHandle> = O.none;
  private playerRuntime: O.Option<PlayerRuntime> = O.none;

  constructor(app: Instance) {
    this.app = app;
    this.playerUI = new PlayerUIService();
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  start = (): T.Task<void> =>
    pipe(
      T.fromIO(logger.info("Starting")),
      T.flatMap(() => this.requestAndWaitForConfig()),
      T.flatMap(() => T.fromIO(logger.info("Creating shared PlayerRuntime for VideoBroadcast"))),
      T.flatMap(() => T.fromIO(this.createAndStorePlayerRuntime())),
      T.flatMap(() => T.fromIO(this.setupStateSubscription())),
      T.flatMap(() => T.fromIO(this.setupPlayChannelHandler())),
      T.flatMap(() => T.fromIO(this.setupDispatchKeyHandler())),
      T.flatMap(() => T.fromIO(this.initializeHbbTV())),
      T.flatMap(() => T.fromIO(this.initializePlayerUI())),
      T.flatMap(() => this.notifyReady()),
      T.flatMap(() => T.fromIO(logger.info("Started"))),
    );

  // ============================================================================
  // Config Bootstrap
  // ============================================================================

  /**
   * Request and wait for initial configuration from background script.
   * Pure functional pipeline with explicit side-effect management.
   */
  private requestAndWaitForConfig = (): T.Task<void> =>
    pipe(
      TE.Do,
      TE.tap(() => TE.rightIO(logger.debug("Requesting config from background"))),
      TE.flatMap(() =>
        pipe(
          sendGetState(this.app),
          TE.mapError((error) => responseError(String(error))),
        ),
      ),
      TE.bind("config", () => waitForState(this.app)),
      TE.tap(({ config }) =>
        TE.rightIO(
          pipe(
            logger.info("Config received"),
            IO.flatMap(() => this.storeConfig(config)),
          ),
        ),
      ),
      TE.tapError((error) =>
        pipe(
          error,
          O.of,
          O.filter((e) => e.type === "TimeoutError"),
          O.match(
            () => TE.fromIO(logger.error("Config error:", error.message)),
            () => TE.fromIO(logger.warn("Failed to get initial config:", error.message)),
          ),
        ),
      ),
      TE.match(
        () => undefined,
        () => undefined,
      ),
    );

  // ============================================================================
  // PlayerRuntime Setup
  // ============================================================================

  /**
   * Create PlayerRuntime instance with web adapters.
   * Pure function that returns new runtime instance.
   */
  private createPlayerRuntime = (): IO.IO<PlayerRuntime> =>
    pipe(
      logger.debug("Creating PlayerRuntime instance with adapters"),
      IO.map(() => {
        const config: PlayerRuntimeConfig = {
          adapters: {
            native: new NativeAdapter(),
            hls: new HLSAdapter(),
            dash: new DASHAdapter(),
          },
        };
        return new PlayerRuntime(config);
      }),
    );

  /**
   * Create and store PlayerRuntime instance.
   * Wraps side effect in IO.
   */
  private createAndStorePlayerRuntime = (): IO.IO<void> =>
    pipe(
      this.createPlayerRuntime(),
      IO.flatMap((runtime) => () => {
        this.playerRuntime = O.some(runtime);
        logger.debug("Shared PlayerRuntime created and stored")();
      }),
    );

  /**
   * Create PlayerRuntimeFactory for AVControl instances.
   * Factory pattern for creating isolated runtime instances.
   */
  private createPlayerRuntimeFactory = (): IO.IO<PlayerRuntimeFactory> =>
    pipe(
      IO.of({
        create: (): PlayerRuntime => {
          logger.debug("Factory: Creating new PlayerRuntime instance")();
          return this.createPlayerRuntime()();
        },
        destroy: (runtime: PlayerRuntime): void => {
          logger.debug("Factory: Destroying PlayerRuntime instance")();
          runtime.destroy().catch(() => {});
        },
      }),
    );

  // ============================================================================
  // HbbTV Runtime Integration
  // ============================================================================

  /**
   * Initialize HbbTV runtime with shared and factory-based PlayerRuntime instances.
   * Pure functional pipeline that handles config availability.
   */
  private initializeHbbTV = (): IO.IO<void> =>
    pipe(
      this.config,
      O.match(
        () => logger.error("No config available, skipping HbbTV runtime initialization"),
        (extensionState) =>
          pipe(
            logger.info("Initializing HbbTV runtime"),
            IO.flatMap(() => this.createPlayerRuntimeFactory()),
            IO.flatMap((factory) =>
              pipe(
                logger.debug("Passing shared runtime (VideoBroadcast) and factory (AVControl)"),
                IO.flatMap(() =>
                  pipe(this.playerRuntime, O.toUndefined, (sharedRuntime) =>
                    runtime(createRuntimeEnv(extensionState, sharedRuntime, factory)),
                  ),
                ),
              ),
            ),
            IO.flatMap((handle) =>
              pipe(
                logger.debug("Saving runtime handle"),
                IO.flatMap(() => this.storeRuntimeHandle(handle)),
                IO.flatMap(() => this.updateRuntimeState(extensionState)),
              ),
            ),
          ),
      ),
    );

  /**
   * Setup subscription to state updates from background script.
   * Emits updates to runtime and player UI.
   */
  private setupStateSubscription = (): IO.IO<void> =>
    pipe(
      logger.debug("Setting up state subscription"),
      IO.flatMap(() =>
        this.app.on("STATE_UPDATED", (envelope) =>
          pipe(
            logger.info("State update received", envelope.message.payload),
            IO.flatMap(() => this.storeConfig(envelope.message.payload)),
            IO.flatMap(() => this.updateRuntimeState(envelope.message.payload)),
            IO.flatMap(() => this.updatePlayerUI(envelope.message.payload)),
          ),
        ),
      ),
    );

  /**
   * Setup handler for PLAY_CHANNEL messages.
   * Updates VideoBroadcast state through runtime handle.
   */
  private setupPlayChannelHandler = (): IO.IO<void> =>
    pipe(
      logger.debug("Setting up PLAY_CHANNEL handler"),
      IO.flatMap(() =>
        this.app.on("PLAY_CHANNEL", (envelope) =>
          pipe(
            logger.info("PLAY_CHANNEL received", envelope.message.payload),
            IO.flatMap(() =>
              pipe(
                this.runtimeHandle,
                O.match(
                  () => logger.warn("No runtime handle, cannot play channel"),
                  (handle) =>
                    pipe(
                      logger.debug("Playing channel via runtime"),
                      IO.flatMap(() =>
                        pipe(
                          IO.of(mapChannelConfigToOIPFChannel(envelope.message.payload)),
                          IO.flatMap((oipfChannel) =>
                            handle.updateState({
                              videoBroadcast: { currentChannel: oipfChannel },
                            }),
                          ),
                        ),
                      ),
                    ),
                ),
              ),
            ),
          ),
        ),
      ),
    );

  /**
   * Setup handler for DISPATCH_KEY messages.
   * Forwards key events to HbbTV runtime.
   */
  private setupDispatchKeyHandler = (): IO.IO<void> =>
    pipe(
      logger.debug("Setting up DISPATCH_KEY handler"),
      IO.flatMap(() =>
        this.app.on("DISPATCH_KEY", (envelope) =>
          pipe(
            logger.info("DISPATCH_KEY received", envelope.message.payload),
            IO.flatMap(() =>
              pipe(
                this.runtimeHandle,
                O.match(
                  () => logger.warn("No runtime handle, cannot dispatch key"),
                  (handle) =>
                    pipe(
                      logger.debug("Dispatching key via runtime:", envelope.message.payload),
                      IO.flatMap(() => handle.dispatchKey(envelope.message.payload)),
                    ),
                ),
              ),
            ),
          ),
        ),
      ),
    );

  /**
   * Update HbbTV runtime state with new extension state.
   * Pure functional pipeline that handles missing runtime handle.
   */
  private updateRuntimeState = (extensionState: ExtensionState): IO.IO<void> =>
    pipe(
      this.runtimeHandle,
      O.match(
        () => logger.warn("No runtime handle available, skipping HbbTV state update"),
        (handle) =>
          pipe(
            logger.debug("Updating HbbTV runtime state"),
            IO.flatMap(() => handle.updateExtensionState(extensionState)),
            IO.flatMap(() => handle.updateState(extensionState.hbbtv)),
          ),
      ),
    );

  // ============================================================================
  // Player UI Integration
  // ============================================================================

  /**
   * Initialize Player UI based on config visibility setting.
   * Pure functional pipeline that handles config and runtime availability.
   */
  private initializePlayerUI = (): IO.IO<void> =>
    pipe(
      this.config,
      O.match(
        () => logger.debug("No config available, skipping Player UI initialization"),
        (extensionState) =>
          pipe(
            logger.debug("Initializing Player UI with visibility:", extensionState.playerUiVisible),
            IO.flatMap(() =>
              pipe(
                O.Do,
                O.bind("runtime", () => this.playerRuntime),
                O.filter(() => extensionState.playerUiVisible),
                O.match(
                  () => IO.of(undefined),
                  ({ runtime }) => this.playerUI.show(runtime),
                ),
              ),
            ),
          ),
      ),
    );

  /**
   * Update Player UI visibility based on extension state.
   * Delegates to PlayerUIService with optional runtime.
   */
  private updatePlayerUI = (extensionState: ExtensionState): IO.IO<void> =>
    pipe(
      logger.debug("Updating Player UI visibility:", extensionState.playerUiVisible),
      IO.flatMap(() =>
        pipe(this.playerRuntime, O.toUndefined, (runtime) =>
          this.playerUI.setVisible(extensionState.playerUiVisible, runtime),
        ),
      ),
    );

  // ============================================================================
  // Lifecycle Handshake
  // ============================================================================

  /**
   * Notify background script that content script is ready.
   */
  private notifyReady = (): T.Task<void> =>
    pipe(
      T.fromIO(logger.debug("Notifying background that content script is ready")),
      T.flatMap(() => this.app.send("BACKGROUND_SCRIPT", { type: "CONTENT_SCRIPT_READY", payload: null })),
      T.map(() => undefined),
    );

  // ============================================================================
  // Private Helpers - State Management
  // ============================================================================

  /**
   * Store config in local state.
   * Pure side effect wrapped in IO.
   */
  private storeConfig =
    (config: ExtensionState): IO.IO<void> =>
    () => {
      this.config = O.some(config);
    };

  /**
   * Store runtime handle in local state.
   * Pure side effect wrapped in IO.
   */
  private storeRuntimeHandle =
    (handle: RuntimeHandle): IO.IO<void> =>
    () => {
      this.runtimeHandle = O.some(handle);
    };
}

const start = (app: Instance): T.Task<void> =>
  pipe(
    T.fromIO(logger.info("Bootstrapping")),
    T.flatMap(() => new ContentScriptService(app).start()),
  );

start(new App())();
