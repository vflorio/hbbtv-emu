import { createLogger } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import { createRuntimeEnv, runtime } from "@hbb-emu/runtime";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { App, type Instance } from "./app";
import { getConfig, getRuntimeHandle, setConfig, setReady, setRuntimeHandle } from "./state";
import { responseError, sendGetState, waitForState } from "./utils";

const logger = createLogger("ContentScript");

export type ContentScript = Readonly<{
  start: () => T.Task<void>;
}>;

export class ContentScriptService implements ContentScript {
  readonly #app: Instance;

  constructor(app: Instance) {
    this.#app = app;
  }

  start = (): T.Task<void> =>
    pipe(
      T.fromIO(logger.info("Starting")),
      T.flatMap(() => this.#requestAndWaitForConfig()),
      T.flatMap(() => T.fromIO(this.#setupStateSubscription())),
      T.flatMap(() => T.fromIO(this.#initializeHbbTV())),
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
              IO.flatMap(() => runtime(createRuntimeEnv(extensionState))),
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
