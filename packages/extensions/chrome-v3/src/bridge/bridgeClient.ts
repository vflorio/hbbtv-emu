import type { ClassType } from "@hbb-emu/core";
import { createLogger } from "@hbb-emu/core";
import { createEnvelope } from "@hbb-emu/core/message-bus";
import { pipe } from "fp-ts/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";

const logger = createLogger("Bridge:Client");

export type BridgeReadyError = Readonly<{
  type: "BridgeReadyError";
  message: string;
}>;

export const bridgeReadyError = (message: string): BridgeReadyError => ({
  type: "BridgeReadyError",
  message,
});

export interface BridgeClient {
  notifyReady: () => T.Task<void>;
}

// Sends BRIDGE_READY notification to background script

export const WithBridgeClient = <T extends ClassType>(Base: T) =>
  class extends Base implements BridgeClient {
    notifyReady = (): T.Task<void> =>
      pipe(
        T.fromIO(logger.info("Bridge loaded, notifying background")),
        T.flatMap(() => sendBridgeReady()),
        T.flatMap(
          TE.matchE(
            (error) => T.fromIO(logger.error("Failed to send BRIDGE_READY:", error.message)),
            () => T.fromIO(logger.debug("BRIDGE_READY sent successfully")),
          ),
        ),
      );
  };

const sendBridgeReady = (): T.Task<TE.TaskEither<BridgeReadyError, void>> =>
  T.of(
    TE.tryCatch(
      () =>
        chrome.runtime
          .sendMessage(createEnvelope("BRIDGE_SCRIPT", "BACKGROUND_SCRIPT", { type: "BRIDGE_READY", payload: null }))
          .then(() => undefined),
      (error): BridgeReadyError => bridgeReadyError(error instanceof Error ? error.message : String(error)),
    ),
  );
