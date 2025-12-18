import { type ClassType, createLogger } from "@hbb-emu/core";
import {
  type BridgeContextPayload,
  createEnvelope,
  type MessageEnvelope,
  validateEnvelope,
} from "@hbb-emu/extension-common";
import { isFromSamePage } from "@hbb-emu/runtime-web";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOE from "fp-ts/IOEither";
import * as IOO from "fp-ts/IOOption";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { type AppState, getTabId, setTabId } from "./state";

const logger = createLogger("Bridge:Forwarder");

export interface BridgeForwarder {
  notifyReady: T.Task<void>;
}

/**
 * Content Script → postMessage → Bridge → chrome.runtime → Background
 * Background → chrome.runtime → Bridge → postMessage → Content Script
 */
export const WithBridgeForwarder = <T extends ClassType<AppState>>(Base: T) =>
  class extends Base implements BridgeForwarder {
    constructor(...args: any[]) {
      super(...args);
      window.addEventListener("message", this.handlePostMessage);
      chrome.runtime.onMessage.addListener(this.handleChromeMessage);
    }

    handlePostMessage = (event: MessageEvent) =>
      pipe(
        event,
        TO.fromPredicate(isFromSamePage),
        TO.flatMap((e) => TO.fromOption(O.fromEither(validateEnvelope(e.data)))),
        TO.flatMap((envelope) =>
          pipe(
            T.fromIO(this.runState(getTabId)),
            T.map(enrichEnvelopeWithContext),
            T.map((enrich) => enrich(envelope)),
            T.flatMap(forwardToBackground),
            T.map(() => O.some(undefined)),
          ),
        ),
        TO.getOrElse(() => T.of(undefined)),
      )();

    handleChromeMessage = (message: unknown): void =>
      pipe(
        IOE.fromEither(validateEnvelope(message)),
        IOE.flatMapIO((envelope) =>
          pipe(
            extractBridgeContextTabId(envelope),
            IOO.fromOption,
            IOO.flatMapIO((tabId) =>
              pipe(
                logger.info(`Received bridge context with tabId: ${tabId}`),
                IO.flatMap(() => this.runState(setTabId(tabId))),
                IO.tap(() => sendBridgeContextReceived),
              ),
            ),
            IOO.getOrElse(() => forwardToContentScript(envelope)),
            IO.map(() => undefined),
          ),
        ),
        IOE.getOrElse(() => IO.of(undefined)),
      )();

    notifyReady: T.Task<void> = pipe(
      sendBridgeReady,
      TE.matchE(
        (error) => T.fromIO(logger.error("Failed to send BRIDGE_SCRIPT_READY:", error.message)),
        () => T.fromIO(logger.debug("BRIDGE_SCRIPT_READY sent successfully")),
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
    logger.debug("Forwarding to content script:", envelope.message.type),
    IO.tap(() => () => window.postMessage(envelope, "*")),
  );

const sendBridgeReady: TE.TaskEither<BridgeForwardError, void> = TE.tryCatch(
  () =>
    chrome.runtime
      .sendMessage(createEnvelope("BRIDGE_SCRIPT", "BACKGROUND_SCRIPT", { type: "BRIDGE_SCRIPT_READY", payload: null }))
      .then(() => undefined),
  (error): BridgeForwardError => bridgeForwardError(error instanceof Error ? error.message : String(error)),
);

const sendBridgeContextReceived: IO.IO<void> = () =>
  chrome.runtime
    .sendMessage(
      createEnvelope("BRIDGE_SCRIPT", "BACKGROUND_SCRIPT", { type: "BRIDGE_CONTEXT_RECEIVED", payload: null }),
    )
    .catch(() => undefined);

const enrichEnvelopeWithContext =
  (tabId: O.Option<number>) =>
  (envelope: MessageEnvelope): MessageEnvelope =>
    pipe(
      tabId,
      O.match(
        () => envelope,
        (id): MessageEnvelope => ({ ...envelope, context: { tabId: id } }),
      ),
    );

const isUpdateBridgeContext = (
  envelope: MessageEnvelope,
): envelope is MessageEnvelope<{ type: "UPDATE_BRIDGE_CONTEXT"; payload: BridgeContextPayload }> =>
  envelope.message.type === "UPDATE_BRIDGE_CONTEXT";

const extractBridgeContextTabId = (envelope: MessageEnvelope): O.Option<number> =>
  pipe(
    envelope,
    O.fromPredicate(isUpdateBridgeContext),
    O.map((e) => (e.message.payload as BridgeContextPayload).tabId),
  );

export type BridgeForwardError = Readonly<{
  type: "BridgeForwardError";
  message: string;
}>;

export const bridgeForwardError = (message: string): BridgeForwardError => ({
  type: "BridgeForwardError",
  message,
});
