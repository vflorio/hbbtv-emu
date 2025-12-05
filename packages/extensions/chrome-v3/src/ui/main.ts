import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as T from "fp-ts/Task";
import { App, type Instance } from "./app";
import { loadInitialConfig, setupConfigSubscription } from "./handlers";

const logger = createLogger("SidePanel");

const initialize = (app: Instance): T.Task<void> =>
  pipe(
    T.fromIO(logger.info("Side Panel loading")),
    T.flatMap(() => loadInitialConfig(app)),
    T.flatMap(() => T.fromIO(setupConfigSubscription(app))),
    T.flatMap(() => T.fromIO(logger.info("Side Panel initialized"))),
  );

const app = new App();
initialize(app)();
