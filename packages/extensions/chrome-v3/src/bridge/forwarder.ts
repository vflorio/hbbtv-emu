import type { ClassType } from "@hbb-emu/core";
import { createLogger } from "@hbb-emu/core";
import { createEnvelope, type MessageEnvelope, validateEnvelope } from "@hbb-emu/core/message-bus";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOE from "fp-ts/IOEither";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";

const logger = createLogger("Bridge:Forwarder");

export interface BridgeForwarder {
  notifyReady: T.Task<void>;
}

/**
 * Content Script → postMessage → Bridge → chrome.runtime → Background
 * Background → chrome.runtime → Bridge → postMessage → Content Script
 */
export const WithBridgeForwarder = <T extends ClassType>(Base: T) =>
  class extends Base implements BridgeForwarder {
    constructor(...args: any[]) {
      super(...args);
      window.addEventListener("message", this.handlePostMessage);
      chrome.runtime.onMessage.addListener(this.handleChromeMessage);
    }

    handlePostMessage = (event: MessageEvent): void => {
      pipe(
        TE.fromIO(() => event),
        TE.filterOrElse(
          (e) => e.source === window,
          () => bridgeForwardError("Message source is not window"),
        ),
        TE.flatMapEither((event) => validateEnvelope(event.data)),
        TE.flatMapTask(forwardToBackground),
      )();
    };

    handleChromeMessage = (message: unknown): void => {
      pipe(IOE.fromEither(validateEnvelope(message)), IOE.flatMapIO(forwardToContentScript))();
    };

    notifyReady: T.Task<void> = pipe(
      sendBridgeReady,
      TE.matchE(
        (error) => T.fromIO(logger.error("Failed to send BRIDGE_READY:", error.message)),
        () => T.fromIO(logger.debug("BRIDGE_READY sent successfully")),
      ),
    );
  };

const forwardToBackground = (envelope: MessageEnvelope): T.Task<void> =>
  pipe(
    TE.tryCatch(
      () => chrome.runtime.sendMessage(envelope).then(() => undefined),
      (error): BridgeForwardError => bridgeForwardError(error instanceof Error ? error.message : String(error)),
    ),
    TE.tapIO(() => logger.debug("Forwarded to background:", envelope.message.type)),
    TE.orElseFirstIOK((error) => logger.warn("Failed to forward to background:", error.message)),
    TE.getOrElse(() => T.of(undefined)),
  );

const forwardToContentScript = (envelope: MessageEnvelope): IO.IO<void> =>
  pipe(
    IO.of(envelope),
    IO.tap((env) => () => window.postMessage(env, "*")),
    IO.tap((env) => logger.debug("Forwarded to content script:", env.message.type)),
    IO.map(() => undefined),
  );

const sendBridgeReady: TE.TaskEither<BridgeForwardError, void> = pipe(
  TE.tryCatch(
    () =>
      chrome.runtime
        .sendMessage(createEnvelope("BRIDGE_SCRIPT", "BACKGROUND_SCRIPT", { type: "BRIDGE_READY", payload: null }))
        .then(() => undefined),
    (error): BridgeForwardError => bridgeForwardError(error instanceof Error ? error.message : String(error)),
  ),
);

export type BridgeForwardError = Readonly<{
  type: "BridgeForwardError";
  message: string;
}>;

export const bridgeForwardError = (message: string): BridgeForwardError => ({
  type: "BridgeForwardError",
  message,
});
