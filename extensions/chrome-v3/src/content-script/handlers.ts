import { createLogger } from "@hbb-emu/core";
import type { ExtensionState } from "@hbb-emu/extension-common";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { Instance } from "./app";
import { getConfig, setConfig, setReady } from "./state";
import { responseError, sendGetState, waitForState } from "./utils";

const logger = createLogger("ContentScript:Handlers");

export const requestAndWaitForConfig = (app: Instance): T.Task<void> =>
  pipe(
    TE.Do,
    TE.tap(() => TE.rightIO(logger.debug("Requesting config from background"))),
    TE.flatMap(() =>
      pipe(
        sendGetState(app),
        TE.mapError((error) => responseError(String(error))),
      ),
    ),
    TE.bind("config", () => waitForState(app)),
    TE.tap(({ config }) =>
      TE.rightIO(
        pipe(
          logger.info("Config received"),
          IO.flatMap(() => app.runState(setConfig(config))),
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

export const setupConfigSubscription = (app: Instance): IO.IO<void> =>
  pipe(
    logger.debug("Setting up config subscription"),
    IO.flatMap(() =>
      app.on("STATE_UPDATED", (envelope) =>
        pipe(
          logger.info("Config update received"),
          IO.flatMap(() => {
            const config = envelope.message.payload as ExtensionState;
            return app.runState(setConfig(config));
          }),
          // TODO: Update HbbTV API with new config
        ),
      ),
    ),
  );

export const notifyReady = (app: Instance): T.Task<void> =>
  pipe(
    T.fromIO(logger.debug("Notifying background that content script is ready")),
    T.flatMap(() => app.send("BACKGROUND_SCRIPT", { type: "CONTENT_SCRIPT_READY", payload: null })),
    T.flatMap(() => T.fromIO(app.runState(setReady))),
  );

export const initializeHbbTVApi = (app: Instance): IO.IO<void> =>
  pipe(
    app.runState(getConfig),
    IO.flatMap(
      O.match(
        () => logger.error("No config available, skipping HbbTV provider initialization"),
        (config) =>
          pipe(
            IO.Do,
            // IO.of(new Provider()),
            // IO.tap(() => logger.info("Initializing HbbTV Provider with config", config)),
            // IO.flatMap((provider) => provider.initialize(config)),
          ),
      ),
    ),
  );
