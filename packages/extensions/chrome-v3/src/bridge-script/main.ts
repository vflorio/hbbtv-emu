import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as T from "fp-ts/Task";
import { App, type Instance } from "./app";

const logger = createLogger("Bridge");

const initialize = (app: Instance): T.Task<void> =>
  pipe(
    T.fromIO(logger.info("Initializing")),
    // TODO: termina in caso non siamo in una pagina HbbTV
    T.flatMap(() => app.notifyReady),
    T.flatMap(() => T.fromIO(logger.info("Initialized"))),
  );

const app = new App();
initialize(app)();
