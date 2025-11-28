import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../../logger";
import { type ClassType, compose } from "../../mixin";
import {
  type Message,
  type MessageAdapter,
  type MessageAdapterError,
  type MessageEnvelope,
  WithMessageAdapter,
} from "..";

const logger = createLogger("Chrome Message Listener");

const hasNoListenersError = E.fromPredicate(
  (error: unknown): error is Error => error instanceof Error && error.message.includes("Receiving end does not exist"),
  (error) => error as ChromeMessageError,
);

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
    ): TE.TaskEither<MessageAdapterError | ChromeMessageAdapterError, void> => {
      logger.log("Sending message", envelope);

      const sendToBackgroundScript = (): TE.TaskEither<ChromeMessageAdapterError, void> =>
        pipe(
          TE.tryCatch(
            () => chrome.runtime.sendMessage(envelope),
            (error) => chromeMessageError(error instanceof Error ? error.message : String(error)),
          ),
          TE.flatMap((result) =>
            pipe(
              result,
              hasNoListenersError,
              E.match(
                () => TE.left(chromeNoMessageListenersError("No message listeners registered in service worker")),
                () => TE.right(undefined),
              ),
            ),
          ),
        );

      const sendToContentScript = (tabId: number): TE.TaskEither<ChromeMessageAdapterError, void> =>
        pipe(
          TE.tryCatch(
            () => chrome.tabs.sendMessage(tabId, envelope),
            (error) => chromeMessageError(error instanceof Error ? error.message : String(error)),
          ),
          TE.flatMap((result) =>
            pipe(
              result,
              hasNoListenersError,
              E.match(
                () => TE.left(chromeNoMessageListenersError(`No message listeners registered in tab ${tabId}`)),
                () => TE.right(undefined),
              ),
            ),
          ),
        );

      const sendByTarget = (): TE.TaskEither<ChromeMessageAdapterError, void> =>
        pipe(
          envelope.target,
          E.fromPredicate(
            (target) => target === "BACKGROUND_SCRIPT" || target === "CONTENT_SCRIPT",
            (target) => chromeMessageError(`Cannot send message: invalid target ${target}`),
          ),
          TE.fromEither,
          TE.flatMap((target) => {
            const handlers: Record<typeof target, () => TE.TaskEither<ChromeMessageAdapterError, void>> = {
              BACKGROUND_SCRIPT: sendToBackgroundScript,
              CONTENT_SCRIPT: () =>
                pipe(
                  envelope.context?.tabId,
                  E.fromNullable(
                    chromeMessageError("Cannot send message to content script: tabId is missing in context"),
                  ),
                  TE.fromEither,
                  TE.flatMap(sendToContentScript),
                ),
            };

            return handlers[target]();
          }),
        );

      return pipe(
        sendByTarget(),
        TE.tapError((error) => TE.fromIO(() => logger.error("Failed to send message:", error))),
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

export type ChromeMessageAdapterError = ChromeMessageError | ChromeNoMessageListenersError;

export type ChromeMessageError = Readonly<{
  type: "ChromeMessageError";
  message: string;
}>;

export type ChromeNoMessageListenersError = Readonly<{
  type: "NoMessageListenersError";
  message: string;
}>;

export const chromeMessageError = (message: string): ChromeMessageError => ({
  type: "ChromeMessageError",
  message,
});

export const chromeNoMessageListenersError = (message: string): ChromeNoMessageListenersError => ({
  type: "NoMessageListenersError",
  message,
});
