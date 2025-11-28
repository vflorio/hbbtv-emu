import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../logger";
import {
  type Message,
  type MessageAdapter,
  type MessageAdapterError,
  type MessageEnvelope,
  WithMessageAdapter,
} from "../messaging";
import { type ClassType, compose } from "../mixin";

const logger = createLogger("Chrome Message Listener");

const hasNoListenersError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes("Receiving end does not exist");

const WithChromeMessage = <T extends ClassType<MessageAdapter>>(Base: T) =>
  class extends Base implements MessageAdapter {
    constructor(...args: any[]) {
      super(...args);
      chrome.runtime.onMessage.addListener(this.handleChromeMessage);
    }

    handleChromeMessage = (data: MessageEnvelope, sender: chrome.runtime.MessageSender) => {
      logger.log("Received message", data, sender);
      this.handleMessage(data);
    };

    sendMessage = <T extends Message>(
      envelope: MessageEnvelope<T>,
    ): TE.TaskEither<MessageAdapterError | ChromeMessageError | NoMessageListenersError, void> => {
      logger.log("Sending message", envelope);

      const sendToServiceWorker = (): TE.TaskEither<ChromeMessageError | NoMessageListenersError, void> =>
        pipe(
          TE.tryCatch(
            () => chrome.runtime.sendMessage(envelope),
            (error) => chromeMessageError(error instanceof Error ? error.message : String(error)),
          ),
          TE.mapLeft((error) =>
            hasNoListenersError(error)
              ? noMessageListenersError("No message listeners registered in service worker")
              : error,
          ),
          TE.map(() => undefined),
        );

      const sendToContentScript = (tabId: number): TE.TaskEither<ChromeMessageError | NoMessageListenersError, void> =>
        pipe(
          TE.tryCatch(
            () => chrome.tabs.sendMessage(tabId, envelope),
            (error) => chromeMessageError(error instanceof Error ? error.message : String(error)),
          ),
          TE.mapLeft((error) =>
            hasNoListenersError(error)
              ? noMessageListenersError(`No message listeners registered in tab ${tabId}`)
              : error,
          ),
          TE.map(() => undefined),
        );

      const sendByTarget = (): TE.TaskEither<ChromeMessageError | NoMessageListenersError, void> => {
        switch (envelope.target) {
          case "SERVICE_WORKER":
            return sendToServiceWorker();
          case "CONTENT_SCRIPT":
            return pipe(
              E.fromNullable(chromeMessageError("Cannot send message to content script: tabId is missing in context"))(
                envelope.context?.tabId,
              ),
              TE.fromEither,
              TE.flatMap(sendToContentScript),
            );
          default:
            return TE.left(chromeMessageError(`Cannot send message: invalid target ${envelope.target}`));
        }
      };

      return pipe(
        sendByTarget(),
        TE.mapLeft((error) => {
          logger.error(error.message);
          return error;
        }),
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

// Errors

export type ChromeMessageError = Readonly<{
  type: "ChromeMessageError";
  message: string;
}>;

export type NoMessageListenersError = Readonly<{
  type: "NoMessageListenersError";
  message: string;
}>;

export const chromeMessageError = (message: string): ChromeMessageError => ({
  type: "ChromeMessageError",
  message,
});

export const noMessageListenersError = (message: string): NoMessageListenersError => ({
  type: "NoMessageListenersError",
  message,
});
