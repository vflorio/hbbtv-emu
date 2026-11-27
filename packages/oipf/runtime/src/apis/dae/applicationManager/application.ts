import { createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf-api";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { ApplicationExit } from "../../../subsystems/applicationExit";
import type { ApplicationLaunch, ApplicationLoadErrors } from "../../../subsystems/applicationLaunch";
import { applicationUrl, LaunchedApplication } from "./launchedApplication";
import { type ApplicationPrivateDataEnv, createApplicationPrivateData } from "./privateData";

const logger = createLogger("OipfApplicationManager/Application");

/**
 * Environment for Application: the current broadcast channel and the keyset (via
 * ApplicationPrivateData), the TV to tell when the application exits or starts
 * another, and the page's application managers, which hear when it could not.
 */
export type ApplicationEnv = ApplicationPrivateDataEnv &
  Readonly<{
    exitApplication: ApplicationExit;
    launchApplication: ApplicationLaunch;
    applicationLoadErrors: ApplicationLoadErrors;
  }>;

export class Application implements OIPF.DAE.ApplicationManager.Application {
  readonly #document: Document;
  readonly #env: ApplicationEnv;
  readonly privateData: OIPF.DAE.ApplicationManager.ApplicationPrivateData;

  constructor(document: Document, env: ApplicationEnv) {
    this.#document = document;
    this.#env = env;
    this.privateData = createApplicationPrivateData(env);
  }

  getKeyset = (): OIPF.DAE.ApplicationManager.Keyset => this.privateData.keyset;

  show = (): void => {
    pipe(
      logger.debug("Application.show()"),
      IO.flatMap(() =>
        IO.of(() => {
          if (this.#document.body) {
            this.#document.body.style.visibility = "visible";
          }
        }),
      ),
    )();
  };

  hide = (): void => {
    pipe(
      logger.debug("Application.hide()"),
      IO.flatMap(() =>
        IO.of(() => {
          if (this.#document.body) {
            this.#document.body.style.visibility = "hidden";
          }
        }),
      ),
    )();
  };

  activate = (): void => {
    logger.debug("Application.activate()")();
  };

  deactivate = (): void => {
    logger.debug("Application.deactivate()")();
  };

  destroy = (): void => {
    logger.debug("Application.destroy()")();
  };

  /**
   * The application exits (OIPF DAE §7.2.2.2, §5.1.2): the TV stops it and starts
   * what the AIT says next, maybe the same application (TS 102 796 §6.2.2.3). The
   * TV does it by loading another page, so the application runs until that page
   * loads, not only until this call returns; it is the emulator's limit.
   */
  destroyApplication = (): void => {
    pipe(
      logger.info("Application.destroyApplication(): the application exits"),
      IO.flatMap(() => this.#env.exitApplication),
    )();
  };

  /**
   * Starts another application (OIPF DAE §7.2.2.2), which takes this one's place: an
   * HTTP(S) page becomes a broadcast-independent application (TS 102 796 §6.2.2.6.1),
   * `dvb://current.ait/<org>.<app>` starts that application of the current service's
   * AIT (§9.2). The TV decides, asynchronously; if it cannot, the page's application
   * managers fire `ApplicationLoadError` with the object returned here. `null` for a
   * URL no application can be created from.
   *
   * HbbTV has only `createChild` false (TS 102 796 Annex A): there are no child
   * applications, so true starts it the same way.
   */
  createApplication = (uri: string, createChild?: boolean): OIPF.DAE.ApplicationManager.Application | null => {
    const url = applicationUrl(uri, this.#document.baseURI);
    if (url === null) {
      logger.warn(`createApplication(${String(uri)}): no application can be created from it`)();
      return null;
    }
    if (createChild === true) {
      logger.warn("createApplication(…, true): HbbTV has no child applications; the new one replaces this one")();
    }
    logger.info(`createApplication(${url})`)();
    const launched = new LaunchedApplication();
    void this.#env
      .launchApplication(url)()
      .then(
        E.match(
          (reason) =>
            pipe(
              logger.warn(`The application at ${url} could not be started: ${reason}`),
              IO.tap(() => launched.fail),
              IO.flatMap(() => this.#env.applicationLoadErrors.fire(launched)),
            )(),
          () => undefined,
        ),
      );
    return launched;
  };
}

export const createApplication = (document: Document, env: ApplicationEnv): OIPF.DAE.ApplicationManager.Application =>
  new Application(document, env);
