/**
 * Who acts when the application exits (`Application.destroyApplication()`).
 *
 * On a TV the terminal does: it stops the application, presents the broadcast under
 * its own control, and, if no other application runs and the channel did not change,
 * re-parses the AIT and starts its autostart application again, which may be the one
 * that exited (TS 102 796 §6.2.2.3, §6.2.2.11). In the emulator the host does it,
 * with the tab's TV session (ROADMAP D5): it loads the page the TV shows next, and
 * the application ends with its page. Without a host, nothing stops the application.
 */

import { createLogger } from "@hbb-emu/core";
import type * as IO from "fp-ts/IO";

const logger = createLogger("Runtime:ApplicationExit");

/** Tells the TV that the application exits. The application ends when the TV loads what comes next. */
export type ApplicationExit = IO.IO<void>;

/** Without a host, no TV takes over: the application keeps running. */
export const exitAlone: ApplicationExit = logger.warn(
  "The application exits (destroyApplication()), and no host stops it: it keeps running",
);
