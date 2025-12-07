import { createLogger, type ExtensionConfig } from "@hbb-emu/core";
import { Provider } from "@hbb-emu/provider";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { Instance } from "./app";
import { getConfig, setConfig, setReady } from "./state";

const logger = createLogger("ContentScript:Handlers");

export const requestAndWaitForConfig = (app: Instance): T.Task<void> =>
  pipe(
    T.fromIO(logger.debug("Requesting config from background")),
    T.flatMap(() => app.send("BACKGROUND_SCRIPT", { type: "GET_STATE", payload: null })),
    T.flatMap(() =>
      pipe(
        app.once("STATE_UPDATED", 3000),
        TE.matchE(
          (error) =>
            pipe(
              T.fromIO(logger.warn("Failed to get initial config:", error)),
              T.map(() => undefined),
            ),
          (envelope) =>
            pipe(
              T.fromIO(logger.info("Config received")),
              T.flatMap(() => {
                const config = envelope.message.payload as ExtensionConfig.State;
                return T.fromIO(app.runState(setConfig(config)));
              }),
            ),
        ),
      ),
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
            const config = envelope.message.payload as ExtensionConfig.State;
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
      //O.match(
      //  () => logger.warn("No config available, skipping HbbTV provider initialization"),
      (config) =>
        pipe(
          IO.of(new Provider()),
          IO.tap(() => logger.info("Initializing HbbTV Provider with config", config)),
          IO.flatMap((provider) => provider.initialize(config)),
        ),
      //   ),
    ),
  );
