/**
 * Who starts the application another one asks for (`Application.createApplication()`),
 * and how the page hears that it could not be started.
 *
 * On a TV the terminal does: it loads the new application's first page and stops the
 * one that asked (one application at a time). If the page cannot be loaded, the
 * application that asked is told with `onApplicationLoadError` on its application
 * manager objects (OIPF DAE §7.2.1.3, TS 102 796 §6.2.2.5.6). In the emulator the host
 * does it, with the tab's TV session (ROADMAP D5): it checks the page, then loads it in
 * the tab, and the application that asked ends with its page.
 */

import { createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf-api";
import type * as IO from "fp-ts/IO";
import * as TE from "fp-ts/TaskEither";

const logger = createLogger("Runtime:ApplicationLaunch");

/**
 * Asks the TV to start the application at `url`: an absolute HTTP(S) URL, or a `dvb:`
 * one. Fails with the reason if the TV cannot; if it can, the page ends, and the task
 * never settles.
 */
export type ApplicationLaunch = (url: string) => TE.TaskEither<string, void>;

/** Without a host, the page goes to an HTTP(S) URL itself; a `dvb:` one names nothing it knows. */
export const launchAlone: ApplicationLaunch = (url) =>
  /^https?:/i.test(url)
    ? TE.fromIO(() => {
        logger.warn(`No host starts ${url}: the page goes there itself`)();
        globalThis.location.assign(url);
      })
    : TE.left("no TV to start an application from its AIT");

/**
 * The page's application manager objects, to tell when an application could not be
 * started: each one fires its `ApplicationLoadError` (OIPF DAE §7.2.1.4).
 */
export type ApplicationLoadErrors = Readonly<{
  /** An application manager object of the page; it fires the event with the application. */
  add: (fire: (application: OIPF.DAE.ApplicationManager.Application) => void) => IO.IO<void>;
  /** The application could not be started: every application manager object fires the event. */
  fire: (application: OIPF.DAE.ApplicationManager.Application) => IO.IO<void>;
}>;

export const createApplicationLoadErrors = (): ApplicationLoadErrors => {
  const managers: Array<(application: OIPF.DAE.ApplicationManager.Application) => void> = [];
  return {
    add: (fire) => () => {
      managers.push(fire);
    },
    fire: (application) => () => {
      for (const fire of managers) fire(application);
    },
  };
};
