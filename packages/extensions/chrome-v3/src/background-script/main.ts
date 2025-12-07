import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as T from "fp-ts/Task";
import { App, type Instance } from "./app";
import { onBridgeScriptReady, onContentScriptReady, onGetState, onStateUpdated } from "./handlers";
import { loadConfigFromStorage } from "./storage";

const logger = createLogger("BackgroundScript");

const initialize = (app: Instance): T.Task<void> =>
  pipe(
    T.fromIO(logger.info("Initializing")),
    T.flatMap(() => loadConfigFromStorage(app)),
    T.flatMap(() =>
      T.fromIO(
        pipe(
          logger.info("Registering handlers"),
          IO.flatMap(() => app.subscribe("CONTENT_SCRIPT_READY", onContentScriptReady(app))),
          IO.flatMap(() => app.subscribe("BRIDGE_SCRIPT_READY", onBridgeScriptReady(app))),
          IO.flatMap(() => app.subscribe("GET_STATE", onGetState(app))),
          IO.flatMap(() => app.subscribe("STATE_UPDATED", onStateUpdated(app))),
        ),
      ),
    ),
    T.flatMap(() => T.fromIO(logger.info("Initialized"))),
  );

const app = new App();
initialize(app)();
