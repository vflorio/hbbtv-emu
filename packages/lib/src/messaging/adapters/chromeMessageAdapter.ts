import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../../logger";
import { type ClassType, compose } from "../../mixin";
import { type Message, type MessageAdapter, type MessageEnvelope, WithMessageAdapter } from "..";

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
  handleChromeMessage: (data: MessageEnvelope, sender: chrome.runtime.MessageSender) => void;
  sendMessage: <T extends Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void>;
}

const WithChromeMessage = <T extends ClassType<MessageAdapter>>(Base: T) =>
  class extends Base implements ChromeMessageAdapter {
    constructor(...args: any[]) {
      super(...args);
      chrome.runtime.onMessage.addListener(this.handleChromeMessage);
    }

    handleChromeMessage: (data: MessageEnvelope, sender: chrome.runtime.MessageSender) => void = (data, sender) => {
      logger.info("Received message", data, sender)();
      this.handleMessage(data);
    };

    sendMessage: <T extends Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void> = (envelope) => {
      logger.info("Sending message", envelope)();

      const sendToExtensionContext = () =>
        TE.tryCatch(
          () => chrome.runtime.sendMessage(envelope),
          (error) => chromeMessageError(error instanceof Error ? error.message : String(error)),
        );

      const sendToContentContext = (tabId: number) =>
        TE.tryCatch(
          () => chrome.tabs.sendMessage(tabId, envelope),
          (error) => chromeMessageError(error instanceof Error ? error.message : String(error)),
        );

      const sendByTarget = () =>
        pipe(
          envelope.target,
          E.fromPredicate(
            (target) => target === "BACKGROUND_SCRIPT" || target === "CONTENT_SCRIPT" || target === "SIDE_PANEL",
            (target) => chromeMessageError(`Cannot send message: invalid target ${target}`),
          ),
          TE.fromEither,
          TE.flatMap((target) =>
            ({
              BACKGROUND_SCRIPT: sendToExtensionContext,
              SIDE_PANEL: sendToExtensionContext,
              CONTENT_SCRIPT: () =>
                pipe(
                  envelope.context?.tabId,
                  E.fromNullable(
                    chromeMessageError("Cannot send message to content script: tabId is missing in context"),
                  ),
                  TE.fromEither,
                  TE.flatMap(sendToContentContext),
                ),
            })[target](),
          ),
          TE.map(() => undefined),
        );

      return pipe(
        sendByTarget(),
        TE.tapError((error) => TE.fromIO(logger.error("Failed to send message:", error.type, error.message))),
      );
    };
  };

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
