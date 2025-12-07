import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as T from "fp-ts/Task";
import { App, type Instance } from "./app";
import { setupBridge, setupConfigSubscription } from "./handlers";

const logger = createLogger("ExtensionUI");

const initialize = (app: Instance): T.Task<void> =>
  pipe(
    T.fromIO(logger.info("Initializing")),
    T.flatMap(() => T.fromIO(setupBridge(app))),
    T.flatMap(() => T.fromIO(setupConfigSubscription(app))),
    T.flatMap(() => T.fromIO(app.render)),
    T.flatMap(() => T.fromIO(logger.info("Initialized"))),
  );

const app = new App();
initialize(app)();
