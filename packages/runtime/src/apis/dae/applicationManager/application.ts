import { createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { type ApplicationPrivateDataEnv, createApplicationPrivateData } from "./privateData";

const logger = createLogger("OipfApplicationManager/Application");

/**
 * Environment for Application.
 * Provides access to the current broadcast channel via ApplicationPrivateData.
 */
export type ApplicationEnv = ApplicationPrivateDataEnv;

export class Application implements OIPF.DAE.ApplicationManager.Application {
  readonly #document: Document;
  readonly privateData: OIPF.DAE.ApplicationManager.ApplicationPrivateData;

  constructor(document: Document, env: ApplicationEnv) {
    this.#document = document;
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
}

export const createApplication = (document: Document, env: ApplicationEnv): OIPF.DAE.ApplicationManager.Application =>
  new Application(document, env);
