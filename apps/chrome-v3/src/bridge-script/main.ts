import { createLogger } from "@hbb-emu/core";
import { isHbbTVPage } from "@hbb-emu/oipf";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { App, type Instance } from "./app";

const logger = createLogger("Bridge");

type BridgeInitError = Readonly<{
  type: "NotHbbTVPage";
  message: string;
}>;

const notHbbTVPageError = (): BridgeInitError => ({
  type: "NotHbbTVPage",
  message: "Page is not an HbbTV page, bridge terminating",
});

const waitForDocumentReady: T.Task<void> = () =>
  new Promise<void>((resolve) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    } else {
      resolve();
    }
  });

const detectHbbTVPage: TE.TaskEither<BridgeInitError, void> = pipe(
  waitForDocumentReady,
  T.flatMap(() => T.fromIO(isHbbTVPage(document))),
  T.map(
    E.fromPredicate(
      (isHbbTV): isHbbTV is true => isHbbTV,
      () => notHbbTVPageError(),
    ),
  ),
  TE.flatMap(() => TE.of(undefined)),
);

const initialize = (app: Instance): T.Task<void> =>
  pipe(
    T.fromIO(logger.info("Initializing")),
    T.flatMap(() => detectHbbTVPage),
    TE.flatMap(() =>
      pipe(
        TE.fromIO(logger.info("HbbTV page detected, notifying background")),
        TE.flatMap(() => TE.fromTask(app.notifyReady)),
        TE.flatMap(() => TE.fromIO(logger.info("Initialized"))),
      ),
    ),
    TE.matchE(
      (error) => T.fromIO(logger.debug(error.message)),
      () => T.of(undefined),
    ),
  );

const app = new App();
initialize(app)();
