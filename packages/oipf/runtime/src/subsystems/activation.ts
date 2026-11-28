/**
 * Whether the application is activated (HbbTV TS 102 796 §10.2.2.1, Table 12, column
 * "Availability"): the digits and the VCR keys are "only available to applications
 * once activated". An application the TV AUTOSTARTed is activated when it receives a
 * key event; any other (PRESENT, broadcast-independent, started by another) when it is
 * launched. Its keyset does not change on activation: the application calls
 * `Keyset.setValue()` again to receive the keys it now may.
 *
 * Activation belongs to the running application, not to the page: the host keeps it in
 * the tab's TV session, so another page of the same application starts activated too.
 * The page starts from what it can tell at `document_start` (`initialActivation` of the
 * protocol), and the host's word replaces that guess when it arrives, until a key event
 * activates the application in the page.
 */

import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { IORef } from "fp-ts/IORef";
import type * as RIO from "fp-ts/ReaderIO";

const logger = createLogger("Activation");

export type Activation = Readonly<{
  activated: IO.IO<boolean>;
  /** The application received a key event: activated from now on. `true` if it just became so. */
  keyReceived: IO.IO<boolean>;
  /**
   * What the TV says (the bootstrap, the tab's session). It replaces what the page
   * assumed, unless a key event already activated the application here (the TV hears of
   * it later). `true` if the activation changed.
   */
  told: (activated: boolean) => IO.IO<boolean>;
}>;

type State = Readonly<{ activated: boolean; byKey: boolean }>;

export const createActivation = (initiallyActivated: boolean): Activation => {
  const state = new IORef<State>({ activated: initiallyActivated, byKey: false });
  return {
    activated: () => state.read().activated,
    keyReceived: () => {
      const { activated } = state.read();
      state.write({ activated: true, byKey: true })();
      return !activated;
    },
    told: (activated) => () => {
      const current = state.read();
      if (current.byKey || current.activated === activated) return false;
      state.write({ activated, byKey: false })();
      return true;
    },
  };
};

export type ActivationEnv = Readonly<{
  activation: Activation;
  /** The application's keyset asks again for its last request, against the keys available now. */
  reapplyKeyset: IO.IO<number>;
  /** Tells the host that the application is activated: it keeps that in the tab's TV session. */
  report: IO.IO<void>;
}>;

/** The application received a key event (`RemoteControlEnv.keyReceived`). */
export const receiveKey: RIO.ReaderIO<ActivationEnv, void> = (env) =>
  pipe(
    env.activation.keyReceived,
    IO.flatMap((activatedNow) =>
      activatedNow
        ? pipe(
            logger.info("Application activated by its first key event: the digits and the VCR keys are available"),
            IO.flatMap(() => env.report),
          )
        : IO.of(undefined),
    ),
  );

/**
 * The TV says whether the application is activated. If that is not what the page
 * assumed, the keyset is what it would have been from the start: the application's
 * requests kept to the keys really available.
 */
export const tellActivation =
  (activated: boolean): RIO.ReaderIO<ActivationEnv, void> =>
  (env) =>
    pipe(
      env.activation.told(activated),
      IO.flatMap((changed) =>
        changed
          ? pipe(
              env.reapplyKeyset,
              IO.flatMap((value) =>
                logger.info(
                  `The TV says the application is ${activated ? "" : "not "}activated: keyset 0x${value.toString(16)}`,
                ),
              ),
            )
          : IO.of(undefined),
      ),
    );

/** Without a host, nobody keeps the activation beyond the page. */
export const reportNowhere: IO.IO<void> = IO.of(undefined);
