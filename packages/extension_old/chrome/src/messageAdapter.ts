import { type ClassType, compose, createLogger } from "@hbb-emu/core";
import {
  type InvalidMessageOriginError,
  type Message,
  type MessageAdapter,
  type MessageEnvelope,
  validateMessageOrigin,
  WithMessageAdapter,
} from "@hbb-emu/extension-common";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";

const logger = createLogger("ChromeMessageAdapter");

export interface ChromeMessageAdapter extends MessageAdapter {
  sendMessage: <T extends Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void>;
}

const WithChromeMessage = <T extends ClassType<MessageAdapter>>(Base: T) =>
  class extends Base implements ChromeMessageAdapter {
    constructor(...args: any[]) {
      super(...args);

      const handleChromeMessage: (data: MessageEnvelope, sender: chrome.runtime.MessageSender) => void = (
        data,
        sender,
      ) =>
        pipe(
          IO.Do,
          IO.bind("tabId", () => IO.of(getTabId(data, sender))),
          IO.map(({ tabId }) => enrichEnvelope(data, tabId)),
          IO.flatMap((envelope) => this.handleMessage(envelope)),
        )();

      chrome.runtime.onMessage.addListener(handleChromeMessage);
    }

    override sendMessage: <T extends Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void> = (
      envelope,
    ) =>
      pipe(
        determineTarget(envelope),
        TE.fromEither,
        TE.flatMap((target) => (target === "EXTENSION" ? sendToExtension(envelope) : sendToTab(envelope))),
        TE.tapError(logSendError),
      );
  };

const getTabId = (data: MessageEnvelope, sender: chrome.runtime.MessageSender): O.Option<number> =>
  pipe(
    O.fromNullable(sender.tab?.id),
    O.alt(() => O.fromNullable(data.context?.tabId)),
  );

const enrichEnvelope = (data: MessageEnvelope, tabId: O.Option<number>): MessageEnvelope =>
  pipe(
    tabId,
    O.match(
      () => data,
      (id) => ({
        ...data,
        context: { tabId: id },
      }),
    ),
  );

type SendTarget = "EXTENSION" | "TAB";

const determineTarget = (
  envelope: MessageEnvelope,
): E.Either<ChromeMessageError | InvalidMessageOriginError, SendTarget> =>
  pipe(
    envelope.target,
    validateMessageOrigin,
    E.map((target): SendTarget => (target === "CONTENT_SCRIPT" || target === "BRIDGE_SCRIPT" ? "TAB" : "EXTENSION")),
  );

const sendToExtension = <T extends Message>(envelope: MessageEnvelope<T>): TE.TaskEither<ChromeMessageError, void> =>
  pipe(
    TE.tryCatch(
      () => chrome.runtime.sendMessage(envelope),
      (error) => chromeMessageError(error instanceof Error ? error.message : String(error)),
    ),
    TE.map(() => undefined),
  );

const sendToTab = <T extends Message>(envelope: MessageEnvelope<T>): TE.TaskEither<ChromeMessageError, void> =>
  pipe(
    O.fromNullable(envelope.context?.tabId),
    TE.fromOption(() => chromeMessageError("Cannot send message to tab: tabId is missing in context")),
    TE.flatMap((tabId) =>
      TE.tryCatch(
        () => chrome.tabs.sendMessage(tabId, envelope),
        (error) => chromeMessageError(error instanceof Error ? error.message : String(error)),
      ),
    ),
    TE.map(() => undefined),
  );

const logSendError = (error: ChromeMessageAdapterError): TE.TaskEither<ChromeMessageError, void> =>
  pipe(
    error.message,
    O.fromPredicate((msg) => !msg?.includes("Receiving end does not exist")),
    O.match(
      () => TE.of(undefined),
      () => TE.fromIO(logger.error("Failed to send message:", error.type, error.message)),
    ),
  );

// biome-ignore format: composition
export const WithChromeMessageAdapter = <T extends ClassType>(Base: T) =>
  compose(
    Base, 
    WithMessageAdapter, 
    WithChromeMessage
);

// Error

export type ChromeMessageError = Readonly<{
  type: "ChromeMessageError";
  message: string;
}>;

export type ChromeNoMessageListenersError = Readonly<{
  type: "NoMessageListenersError";
  message: string;
}>;

export type ChromeMessageAdapterError = ChromeMessageError | ChromeNoMessageListenersError | InvalidMessageOriginError;

export const chromeMessageError = (message: string): ChromeMessageError => ({
  type: "ChromeMessageError",
  message,
});

export const chromeNoMessageListenersError = (message: string): ChromeNoMessageListenersError => ({
  type: "NoMessageListenersError",
  message,
});
