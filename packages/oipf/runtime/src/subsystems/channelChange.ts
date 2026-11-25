/**
 * Who decides an application's change to another service (`setChannel()`).
 *
 * On a TV the terminal does: it changes channel, and the new service's AIT says
 * whether the application keeps running (TS 102 796 §6.2.2.2). In the emulator the
 * host owns that decision (the tab's TV session, ROADMAP D5); without a host, the
 * runtime just tunes.
 */

import type { ChannelConfig } from "@hbb-emu/extension-common";
import type { OIPF } from "@hbb-emu/oipf-api";
import * as TE from "fp-ts/TaskEither";

/**
 * Asks the TV to change to `channel`. Succeeds once the TV is on it; fails with the
 * error the application gets. If the change ends the application (another page
 * loads), it never settles.
 */
export type ChannelChangeRequest = (
  channel: ChannelConfig,
) => TE.TaskEither<OIPF.DAE.Broadcast.ChannelChangeErrorCode, void>;

/** Without a host: every change is allowed, and the object tunes on its own. */
export const tuneAlone: ChannelChangeRequest = () => TE.right(undefined);
