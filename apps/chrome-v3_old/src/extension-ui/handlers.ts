import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { Instance } from "./app";
import { setConfig } from "./state";

const logger = createLogger("ExtensionUI:Handlers");

export const setupConfigSubscription = (app: Instance): IO.IO<void> =>
  pipe(
    logger.debug("Setting up config subscription"),
    IO.flatMap(() =>
      app.on("STATE_UPDATED", (envelope) =>
        pipe(
          logger.info("Config update received from background"),
          IO.flatMap(() =>
            pipe(
              app.runState(setConfig(envelope.message.payload)),
              IO.tap(() => app.notifyStateUpdate(envelope.message.payload)),
            ),
          ),
        ),
      ),
    ),
  );
