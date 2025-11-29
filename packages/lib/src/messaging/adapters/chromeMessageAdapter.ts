import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../../logger";
import { type ClassType, compose } from "../../mixin";
import { type Message, type MessageAdapter, type MessageEnvelope, WithMessageAdapter } from "..";

const logger = createLogger("ChromeMessageListener");

export namespace ChromeMessageAdapter {
  export interface Contract extends MessageAdapter.Contract {
    handleChromeMessage: HandleChromeMessage;
    sendMessage: SendMessage;
  }

  export type Error = ChromeMessageAdapterError;

  export type HandleChromeMessage = (data: MessageEnvelope, sender: chrome.runtime.MessageSender) => void;

  export type SendMessage = <T extends Message>(
    envelope: MessageEnvelope<T>,
  ) => TE.TaskEither<MessageAdapter.Error | ChromeMessageAdapterError, void>;

  export type ChromeMessageAdapterError = ChromeMessageError | ChromeNoMessageListenersError;

  export type ChromeMessageError = Readonly<{
    type: "ChromeMessageError";
    message: string;
  }>;

  export type ChromeNoMessageListenersError = Readonly<{
    type: "NoMessageListenersError";
    message: string;
  }>;
}

const WithChromeMessage = <T extends ClassType<MessageAdapter.Contract>>(Base: T) =>
  class extends Base implements ChromeMessageAdapter.Contract {
    constructor(...args: any[]) {
      super(...args);
      chrome.runtime.onMessage.addListener(this.handleChromeMessage);
    }

    handleChromeMessage: ChromeMessageAdapter.HandleChromeMessage = (data, sender) => {
      logger.info("Received message", data, sender)();
      this.handleMessage(data);
    };

    sendMessage: ChromeMessageAdapter.SendMessage = (envelope) => {
      logger.info("Sending message", envelope)();

      const sendToBackgroundScript = () =>
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

      const sendToContentScript = (tabId: number) =>
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

      const sendByTarget = () =>
        pipe(
          envelope.target,
          E.fromPredicate(
            (target) => target === "BACKGROUND_SCRIPT" || target === "CONTENT_SCRIPT",
            (target) => chromeMessageError(`Cannot send message: invalid target ${target}`),
          ),
          TE.fromEither,
          TE.flatMap((target) =>
            ({
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
            })[target](),
          ),
        );

      return pipe(
        sendByTarget(),
        TE.tapError((error) => TE.fromIO(logger.error("Failed to send message:", error))),
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

const hasNoListenersError = E.fromPredicate(
  (error: unknown): error is Error => error instanceof Error && error.message.includes("Receiving end does not exist"),
  (error) => error as ChromeMessageAdapter.ChromeMessageError,
);

// Errors

export const chromeMessageError = (message: string): ChromeMessageAdapter.ChromeMessageError => ({
  type: "ChromeMessageError",
  message,
});

export const chromeNoMessageListenersError = (message: string): ChromeMessageAdapter.ChromeNoMessageListenersError => ({
  type: "NoMessageListenersError",
  message,
});
