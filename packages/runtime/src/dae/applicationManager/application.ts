import { createLogger } from "@hbb-emu/core";
import { DEFAULT_APPLICATION, type OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { Keyset } from "./keyset";

const logger = createLogger("OipfApplicationManager/Application");

export class Application implements OIPF.DAE.ApplicationManager.Application {
  privateData: OIPF.DAE.ApplicationManager.ApplicationPrivateData = DEFAULT_APPLICATION.privateData ?? {};
  keyset: Keyset;

  constructor(private readonly document: Document) {
    this.keyset = new Keyset();
  }

  getKeyset = (): OIPF.DAE.ApplicationManager.Keyset => this.keyset;

  show = (): void => {
    pipe(
      logger.debug("Application.show()"),
      IO.flatMap(() =>
        IO.of(() => {
          if (this.document.body) {
            this.document.body.style.visibility = "visible";
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
          if (this.document.body) {
            this.document.body.style.visibility = "hidden";
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

export const createApplication = (document: Document): OIPF.DAE.ApplicationManager.Application =>
  new Application(document);
