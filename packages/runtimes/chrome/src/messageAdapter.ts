import { type ClassType, compose, createLogger } from "@hbb-emu/core";
import { type Message, type MessageAdapter, type MessageEnvelope, WithMessageAdapter } from "@hbb-emu/core/message-bus";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";

const logger = createLogger("ChromeMessageListener");

export type ChromeMessageError = Readonly<{
  type: "ChromeMessageError";
  message: string;
}>;

export type ChromeNoMessageListenersError = Readonly<{
  type: "NoMessageListenersError";
  message: string;
}>;

export type ChromeMessageAdapterError = ChromeMessageError | ChromeNoMessageListenersError;

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
          IO.flatMap((envelope) => IO.of(this.handleMessage(envelope))),
        )();

      chrome.runtime.onMessage.addListener(handleChromeMessage);
    }

    override sendMessage: <T extends Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void> = (
      envelope,
    ) =>
      pipe(
        determineTarget(envelope),
        TE.fromEither,
        TE.flatMap((target) => sendToTarget(target, envelope)),
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
    O.fold(
      () => data,
      (id) => ({
        ...data,
        context: { tabId: id },
      }),
    ),
  );

type SendTarget = "EXTENSION" | "CONTENT_SCRIPT";

const determineTarget = (envelope: MessageEnvelope): E.Either<ChromeMessageError, SendTarget> =>
  pipe(
    envelope.target,
    E.fromPredicate(
      (target): target is "BACKGROUND_SCRIPT" | "CONTENT_SCRIPT" | "SIDE_PANEL" =>
        target === "BACKGROUND_SCRIPT" || target === "CONTENT_SCRIPT" || target === "SIDE_PANEL",
      (target) => chromeMessageError(`Cannot send message: invalid target ${target}`),
    ),
    E.map((target): SendTarget => (target === "CONTENT_SCRIPT" ? "CONTENT_SCRIPT" : "EXTENSION")),
  );

const sendToTarget = <T extends Message>(
  target: SendTarget,
  envelope: MessageEnvelope<T>,
): TE.TaskEither<ChromeMessageError, void> =>
  target === "EXTENSION" ? sendToExtension(envelope) : sendToContentScript(envelope);

const sendToExtension = <T extends Message>(envelope: MessageEnvelope<T>): TE.TaskEither<ChromeMessageError, void> =>
  pipe(
    TE.tryCatch(
      () => chrome.runtime.sendMessage(envelope),
      (error) => chromeMessageError(error instanceof Error ? error.message : String(error)),
    ),
    TE.map(() => undefined),
  );

const sendToContentScript = <T extends Message>(
  envelope: MessageEnvelope<T>,
): TE.TaskEither<ChromeMessageError, void> =>
  pipe(
    O.fromNullable(envelope.context?.tabId),
    TE.fromOption(() => chromeMessageError("Cannot send message to content script: tabId is missing in context")),
    TE.flatMap((tabId) =>
      TE.tryCatch(
        () => chrome.tabs.sendMessage(tabId, envelope),
        (error) => chromeMessageError(error instanceof Error ? error.message : String(error)),
      ),
    ),
    TE.map(() => undefined),
  );

const logSendError = (error: ChromeMessageError): TE.TaskEither<ChromeMessageError, void> =>
  pipe(
    error.message,
    O.fromPredicate((msg) => !msg?.includes("Receiving end does not exist")),
    O.match(
      () => TE.of(undefined),
      () => TE.fromIO(logger.error("Failed to send message:", error.type, error.message)),
    ),
  );

// biome-ignore format: ack
export const WithChromeMessageAdapter = <T extends ClassType>(Base: T) =>
  compose(
    Base, 
    WithMessageAdapter, 
    WithChromeMessage
);

// Error constructors

export const chromeMessageError = (message: string): ChromeMessageError => ({
  type: "ChromeMessageError",
  message,
});

export const chromeNoMessageListenersError = (message: string): ChromeNoMessageListenersError => ({
  type: "NoMessageListenersError",
  message,
});
