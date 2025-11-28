import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../logger";
import { type Message, type MessageAdapter, type MessageEnvelope, WithMessageAdapter } from "../messaging";
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

    sendMessage = <T extends Message>(envelope: MessageEnvelope<T>): TE.TaskEither<Error, void> => {
      logger.log("Sending message", envelope);

      const sendToServiceWorker = (): TE.TaskEither<Error, void> =>
        pipe(
          TE.tryCatch(
            () => chrome.runtime.sendMessage(envelope),
            (error) => error as Error,
          ),
          TE.mapLeft((error) =>
            hasNoListenersError(error) ? new Error("No message listeners registered in service worker") : error,
          ),
          TE.map(() => undefined),
        );

      const sendToContentScript = (tabId: number): TE.TaskEither<Error, void> =>
        pipe(
          TE.tryCatch(
            () => chrome.tabs.sendMessage(tabId, envelope),
            (error) => error as Error,
          ),
          TE.mapLeft((error) =>
            hasNoListenersError(error) ? new Error(`No message listeners registered in tab ${tabId}`) : error,
          ),
          TE.map(() => undefined),
        );

      const sendByTarget = (): TE.TaskEither<Error, void> => {
        switch (envelope.target) {
          case "SERVICE_WORKER":
            return sendToServiceWorker();
          case "CONTENT_SCRIPT":
            return pipe(
              E.fromNullable(new Error("Cannot send message to content script: tabId is missing in context"))(
                envelope.context?.tabId,
              ),
              TE.fromEither,
              TE.flatMap(sendToContentScript),
            );
          default:
            return TE.left(new Error(`Cannot send message: invalid target ${envelope.target}`));
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

export const WithChromeMessageAdapter = <T extends ClassType>(Base: T) =>
  compose(Base, WithMessageAdapter, WithChromeMessage);
