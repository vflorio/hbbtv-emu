import { createLogger, type ExtensionConfig } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { Instance } from "./app";
import { setConfig, setLoading } from "./state";

const logger = createLogger("SidePanel:Handlers");

export const loadInitialConfig = (app: Instance): T.Task<void> =>
  pipe(
    T.fromIO(logger.debug("Requesting initial config from background")),
    T.flatMap(() => T.fromIO(app.send("BACKGROUND_SCRIPT", { type: "GET_CONFIG", payload: null }))),
    T.flatMap(() =>
      pipe(
        app.once("STATE_UPDATED", 3000),
        TE.matchE(
          (error) =>
            pipe(
              T.fromIO(logger.error("Failed to load initial config:", error)),
              T.flatMap(() => T.fromIO(app.runState(setLoading(false)))),
            ),
          (envelope) =>
            pipe(
              T.fromIO(logger.info("Initial config loaded")),
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
          logger.info("Config update received from background"),
          IO.flatMap(() => {
            const config = envelope.message.payload as ExtensionConfig.State;
            return app.runState(setConfig(config));
          }),
        ),
      ),
    ),
  );
