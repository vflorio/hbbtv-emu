/**
 * Bridge: content script in the ISOLATED world, the only one that can talk to both
 * the page runtime (through the DOM channel) and the background (extension messaging).
 *
 * It runs on every page but stays passive: it only forwards what the page runtime
 * announces, and the page runtime only starts in HbbTV documents.
 */

import type { Logger } from "@hbb-emu/core";
import { type DomChannel, type HostMessage, isHostMessage, type PageMessage } from "@hbb-emu/protocol";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import * as TE from "fp-ts/TaskEither";
import type { ExtensionChannel } from "../../adapter/extensionChannel";

export type BridgeEnv = Readonly<{
  page: DomChannel<HostMessage, PageMessage>;
  extension: ExtensionChannel<PageMessage>;
  logger: Logger;
}>;

const forwardToExtension =
  (message: PageMessage): RIO.ReaderIO<BridgeEnv, void> =>
  ({ extension, logger }) =>
  () => {
    void pipe(
      extension.send(message),
      TE.orElseFirstIOK((error) => logger.warn(`Could not forward ${message._tag} to the background`, error)),
    )();
  };

const forwardToPage =
  (message: unknown): RIO.ReaderIO<BridgeEnv, void> =>
  ({ page }) =>
    isHostMessage(message) ? page.send(message) : IO.of(undefined);

/** Starts forwarding in both directions. Returns the stop effect. */
export const startBridge: RIO.ReaderIO<BridgeEnv, IO.IO<void>> = (env) =>
  pipe(
    IO.Do,
    IO.bind("stopPage", () => env.page.subscribe((message) => forwardToExtension(message)(env))),
    IO.bind("stopExtension", () => () => env.extension.onMessage((message) => forwardToPage(message)(env))),
    // The page runtime may have announced itself before the bridge was listening.
    IO.tap(() => env.page.send({ _tag: "Host/Hello" })),
    IO.map(({ stopPage, stopExtension }) => () => {
      stopPage();
      stopExtension();
    }),
  );
