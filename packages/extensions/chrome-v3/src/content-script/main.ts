import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as T from "fp-ts/Task";
import { App, type Instance } from "./app";
import { initializeHbbTVApi, notifyReady, requestAndWaitForConfig, setupConfigSubscription } from "./handlers";

const logger = createLogger("ContentScript");

const initialize = (app: Instance): T.Task<void> =>
  pipe(
    T.fromIO(logger.info("Initializing")),
    T.flatMap(() => requestAndWaitForConfig(app)),
    T.flatMap(() => T.fromIO(setupConfigSubscription(app))),
    // instanzia l'elementMatcher (che deve integrare anche la trasformazione dell'userAgent)
    T.flatMap(() => T.fromIO(initializeHbbTVApi(app))),
    T.flatMap(() => notifyReady(app)),
    T.flatMap(() => T.fromIO(logger.info("Initialized"))),
  );

const app = new App();
initialize(app)();
