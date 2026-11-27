import { createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { ApplicationExit } from "../../../subsystems/applicationExit";
import { type ApplicationPrivateDataEnv, createApplicationPrivateData } from "./privateData";

const logger = createLogger("OipfApplicationManager/Application");

/**
 * Environment for Application: the current broadcast channel and the keyset (via
 * ApplicationPrivateData), and the TV to tell when the application exits.
 */
export type ApplicationEnv = ApplicationPrivateDataEnv &
  Readonly<{
    exitApplication: ApplicationExit;
  }>;

export class Application implements OIPF.DAE.ApplicationManager.Application {
  readonly #document: Document;
  readonly #exitApplication: ApplicationExit;
  readonly privateData: OIPF.DAE.ApplicationManager.ApplicationPrivateData;

  constructor(document: Document, env: ApplicationEnv) {
    this.#document = document;
    this.#exitApplication = env.exitApplication;
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
      IO.flatMap(() => this.#exitApplication),
    )();
  };
}

export const createApplication = (document: Document, env: ApplicationEnv): OIPF.DAE.ApplicationManager.Application =>
  new Application(document, env);
