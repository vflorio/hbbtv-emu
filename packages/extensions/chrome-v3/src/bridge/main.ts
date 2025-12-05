import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { App, type Instance } from "./app";

const logger = createLogger("Bridge");

const initialize = (app: Instance): IO.IO<void> =>
  pipe(
    logger.info("Initializing"),
    IO.flatMap(() => app.notifyReady),
    IO.flatMap(() => logger.info("Initialized")),
  );

const app = new App();
initialize(app)();
