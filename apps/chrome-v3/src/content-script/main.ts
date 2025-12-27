import { createLogger } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import { DASHAdapter, HLSAdapter, NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerRuntime, type PlayerRuntimeConfig } from "@hbb-emu/player-runtime";
import { createRuntimeEnv, type PlayerRuntimeFactory, runtime } from "@hbb-emu/runtime";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as S from "fp-ts/State";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { App, type Instance } from "./app";
import { PlayerUIService } from "./player-ui";
import { getConfig, getRuntimeHandle, setConfig, setReady, setRuntimeHandle } from "./state";
import { responseError, sendGetState, waitForState } from "./utils";

const logger = createLogger("ContentScript");

export type ContentScript = Readonly<{
  start: () => T.Task<void>;
}>;

export class ContentScriptService implements ContentScript {
  readonly #app: Instance;
  readonly #playerUI: PlayerUIService;
  #playerRuntime: PlayerRuntime | null = null;

  constructor(app: Instance) {
    this.#app = app;
    this.#playerUI = new PlayerUIService();
  }

  start = (): T.Task<void> =>
    pipe(
      T.fromIO(logger.info("Starting")),
      T.flatMap(() => this.#requestAndWaitForConfig()),
      T.flatMap(() => T.fromIO(logger.info("Creating shared PlayerRuntime for VideoBroadcast"))),
      T.flatMap(() =>
        T.fromIO(() => {
          this.#playerRuntime = this.#createPlayerRuntime();
          logger.debug("Shared PlayerRuntime created")();
        }),
      ),
      T.flatMap(() => T.fromIO(this.#setupStateSubscription())),
      T.flatMap(() => T.fromIO(this.#setupPlayChannelHandler())),
      T.flatMap(() => T.fromIO(this.#setupDispatchKeyHandler())),
      T.flatMap(() => T.fromIO(this.#initializeHbbTV())),
      T.flatMap(() => T.fromIO(this.#initializePlayerUI())),
      T.flatMap(() => this.#notifyReady()),
      T.flatMap(() => T.fromIO(logger.info("Started"))),
    );

  // ───────────────────────────────────────────────────────────────────────────
  // Config bootstrap
  // ───────────────────────────────────────────────────────────────────────────

  #requestAndWaitForConfig = (): T.Task<void> =>
    pipe(
      TE.Do,
      TE.tap(() => TE.rightIO(logger.debug("Requesting config from background"))),
      TE.flatMap(() =>
        pipe(
          sendGetState(this.#app),
          TE.mapError((error) => responseError(String(error))),
        ),
      ),
      TE.bind("config", () => waitForState(this.#app)),
      TE.tap(({ config }) =>
        TE.rightIO(
          pipe(
            logger.info("Config received"),
            IO.flatMap(() => this.#app.runState(setConfig(config))),
          ),
        ),
      ),
      TE.tapError((error) =>
        TE.fromIO(
          error.type === "TimeoutError"
            ? logger.warn("Failed to get initial config:", error.message)
            : logger.error("Config error:", error.message),
        ),
      ),
      TE.match(
        () => undefined,
        () => undefined,
      ),
    );

  // ───────────────────────────────────────────────────────────────────────────
  // PlayerRuntime setup
  // ───────────────────────────────────────────────────────────────────────────

  #createPlayerRuntime = (): PlayerRuntime => {
    logger.debug("Creating PlayerRuntime instance with adapters")();
    const config: PlayerRuntimeConfig = {
      adapters: {
        native: new NativeAdapter(),
        hls: new HLSAdapter(),
        dash: new DASHAdapter(),
      },
    };
    return new PlayerRuntime(config);
  };

  #createPlayerRuntimeFactory = (): PlayerRuntimeFactory => ({
    create: () => {
      logger.debug("Factory: Creating new PlayerRuntime instance")();
      return this.#createPlayerRuntime();
    },
    destroy: (runtime: PlayerRuntime) => {
      logger.debug("Factory: Destroying PlayerRuntime instance")();
      runtime.destroy().catch(() => {});
    },
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Runtime integration
  // ───────────────────────────────────────────────────────────────────────────

  #initializeHbbTV = (): IO.IO<void> =>
    pipe(
      this.#app.runState(getConfig),
      IO.flatMap(
        O.match(
          () => logger.error("No config available, skipping HbbTV runtime initialization"),
          (extensionState) =>
            pipe(
              logger.info("Initializing HbbTV runtime"),
              IO.flatMap(() => {
                const factory = this.#createPlayerRuntimeFactory();
                logger.debug("Passing shared runtime (VideoBroadcast) and factory (AVControl)")();
                return runtime(
                  createRuntimeEnv(
                    extensionState,
                    this.#playerRuntime ?? undefined, // Shared for VideoBroadcast
                    factory, // Factory for AVControl
                  ),
                );
              }),
              IO.flatMap((handle) =>
                pipe(
                  logger.debug("Saving runtime handle"),
                  IO.flatMap(() => this.#app.runState(setRuntimeHandle(handle))),
                  IO.flatMap(() => this.#updateRuntimeState(extensionState)),
                ),
              ),
            ),
        ),
      ),
    );

  #setupStateSubscription = (): IO.IO<void> =>
    pipe(
      logger.debug("Setting up state subscription"),
      IO.flatMap(() =>
        this.#app.on("STATE_UPDATED", (envelope) =>
          pipe(
            logger.info("State update received", envelope.message.payload),
            IO.flatMap(() => this.#app.runState(setConfig(envelope.message.payload))),
            IO.flatMap(() => this.#updateRuntimeState(envelope.message.payload)),
            IO.flatMap(() => this.#updatePlayerUI(envelope.message.payload)),
          ),
        ),
      ),
    );

  #setupPlayChannelHandler = (): IO.IO<void> =>
    pipe(
      logger.debug("Setting up PLAY_CHANNEL handler"),
      IO.flatMap(() =>
        this.#app.on("PLAY_CHANNEL", (envelope) =>
          pipe(
            logger.info("PLAY_CHANNEL received", envelope.message.payload),
            IO.flatMap(() =>
              this.#app.runState(
                pipe(
                  getRuntimeHandle,
                  S.flatMap((handleOpt) =>
                    pipe(
                      handleOpt,
                      O.match(
                        () => S.of(IO.of(logger.warn("No runtime handle, cannot play channel")())),
                        (handle) =>
                          S.of(
                            pipe(
                              logger.debug("Playing channel via runtime"),
                              IO.flatMap(() =>
                                handle.updateState({
                                  videoBroadcast: { currentChannel: envelope.message.payload },
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
            IO.flatten,
          ),
        ),
      ),
    );

  #setupDispatchKeyHandler = (): IO.IO<void> =>
    pipe(
      logger.debug("Setting up DISPATCH_KEY handler"),
      IO.flatMap(() =>
        this.#app.on("DISPATCH_KEY", (envelope) =>
          pipe(
            logger.info("DISPATCH_KEY received", envelope.message.payload),
            IO.flatMap(() =>
              this.#app.runState(
                pipe(
                  getRuntimeHandle,
                  S.flatMap((handleOpt) =>
                    pipe(
                      handleOpt,
                      O.match(
                        () => S.of(IO.of(logger.warn("No runtime handle, cannot dispatch key")())),
                        (handle) =>
                          S.of(
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
            ),
            IO.flatten,
          ),
        ),
      ),
    );

  #updateRuntimeState = (extensionState: ExtensionState): IO.IO<void> =>
    pipe(
      this.#app.runState(getRuntimeHandle),
      IO.flatMap(
        O.match(
          () => logger.warn("No runtime handle available, skipping HbbTV state update"),
          (handle) =>
            pipe(
              logger.debug("Updating HbbTV runtime state"),
              IO.flatMap(() => handle.updateExtensionState(extensionState)),
              IO.flatMap(() => handle.updateState(extensionState.hbbtv)),
            ),
        ),
      ),
    );

  // ───────────────────────────────────────────────────────────────────────────
  // Player UI Integration
  // ───────────────────────────────────────────────────────────────────────────

  #initializePlayerUI = (): IO.IO<void> =>
    pipe(
      this.#app.runState(getConfig),
      IO.flatMap(
        O.match(
          () => logger.debug("No config available, skipping Player UI initialization"),
          (extensionState) =>
            pipe(
              logger.debug("Initializing Player UI with visibility:", extensionState.playerUiVisible),
              IO.flatMap(() => {
                if (extensionState.playerUiVisible && this.#playerRuntime) {
                  return this.#playerUI.show(this.#playerRuntime);
                }
                return IO.of(undefined);
              }),
            ),
        ),
      ),
    );

  #updatePlayerUI = (extensionState: ExtensionState): IO.IO<void> =>
    pipe(
      logger.debug("Updating Player UI visibility:", extensionState.playerUiVisible),
      IO.flatMap(() => this.#playerUI.setVisible(extensionState.playerUiVisible, this.#playerRuntime ?? undefined)),
    );

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle handshake
  // ───────────────────────────────────────────────────────────────────────────

  #notifyReady = (): T.Task<void> =>
    pipe(
      T.fromIO(logger.debug("Notifying background that content script is ready")),
      T.flatMap(() => this.#app.send("BACKGROUND_SCRIPT", { type: "CONTENT_SCRIPT_READY", payload: null })),
      T.flatMap(() => T.fromIO(this.#app.runState(setReady))),
    );
}

const start = (app: Instance): T.Task<void> =>
  pipe(
    T.fromIO(logger.info("Bootstrapping")),
    T.flatMap(() => new ContentScriptService(app).start()),
  );

start(new App())();
