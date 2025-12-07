import { type ChannelConfig, createLogger, type ExtensionState } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { Instance } from "./app";
import { setConfig, setLoading } from "./state";

const logger = createLogger("ExtensionUI:Handlers");

export const setupBridge = (app: Instance): IO.IO<void> =>
  pipe(
    logger.debug("Setting up bridge methods"),
    IO.tap(() => () => {
      // Load state from background
      app.loadState = async (): Promise<ExtensionState> => {
        app.send("BACKGROUND_SCRIPT", { type: "GET_STATE", payload: null })();
        const result = await app.once("STATE_UPDATED", 3000)();
        if (result._tag === "Left") {
          throw new Error(result.left.message);
        }
        return result.right.message.payload as ExtensionState;
      };

      // Save state to background
      app.saveState = async (state: ExtensionState): Promise<void> => {
        app.send("BACKGROUND_SCRIPT", { type: "STATE_UPDATED", payload: state })();
      };

      // Play channel
      app.playChannel = async (channel: ChannelConfig): Promise<void> => {
        app.send("BACKGROUND_SCRIPT", { type: "PLAY_CHANNEL", payload: channel })();
      };
    }),
  );

export const loadInitialConfig = (app: Instance): T.Task<void> =>
  pipe(
    T.fromIO(logger.debug("Requesting initial config from background")),
    T.flatMap(() => T.fromIO(app.send("BACKGROUND_SCRIPT", { type: "GET_STATE", payload: null }))),
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
                const config = envelope.message.payload as ExtensionState;
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
            const config = envelope.message.payload as ExtensionState;
            return pipe(
              app.runState(setConfig(config)),
              IO.tap(() => app.notifyStateUpdate(config)),
            );
          }),
        ),
      ),
    ),
  );
