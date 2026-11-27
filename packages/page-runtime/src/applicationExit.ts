/**
 * The application exits (`destroyApplication()`): the host's TV session decides what
 * the tab shows next (TS 102 796 §6.2.2.3, ROADMAP D5), and loads it.
 *
 * Asked once per page: the application exits once, whichever of its Application
 * objects it calls, and however many times; the page ends when the host loads the
 * next one.
 */

import { createLogger } from "@hbb-emu/core";
import type { ApplicationExit } from "@hbb-emu/oipf-runtime";
import type { PageMessage } from "@hbb-emu/protocol";
import type * as IO from "fp-ts/IO";

const logger = createLogger("PageRuntime:ApplicationExit");

export const createHostApplicationExit = (send: (message: PageMessage) => IO.IO<void>): ApplicationExit => {
  let exiting = false;
  return () => {
    if (exiting) {
      logger.debug("The application is already exiting")();
      return;
    }
    exiting = true;
    send({ _tag: "Page/DestroyApplication" })();
  };
};
