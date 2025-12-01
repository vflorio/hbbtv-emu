import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../../logger";
import { type ClassType, compose } from "../../mixin";
import type { Message } from "../message";
import { type MessageAdapter, WithMessageAdapter } from "../messageAdapter";
import type { MessageEnvelope } from "../messageEnvelope";
import { validateMessageOrigin } from "../messageOrigin";

const logger = createLogger("PostMessageAdapter");

export type PostMessageError = Readonly<{
  type: "PostMessageError";
  message: string;
}>;

export interface PostMessageAdapter extends MessageAdapter {
  handlePostMessage: (event: MessageEvent<MessageEnvelope>) => boolean;
  sendMessage: <T extends Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void>;
}

const WithPostMessage = <T extends ClassType<MessageAdapter>>(Base: T) =>
  class extends Base implements PostMessageAdapter {
    constructor(...args: any[]) {
      super(...args);
      window.addEventListener("message", this.handlePostMessage);
    }

    handlePostMessage: (event: MessageEvent<MessageEnvelope>) => boolean = (event) =>
      pipe(
        validateMessageOrigin(event.origin),
        E.flatMap(() =>
          pipe(
            event.data,
            E.fromPredicate(
              (envelope) => envelope.source !== envelope.target,
              () => true,
            ),
          ),
        ),
        E.map((envelope) => {
          logger.info("Received message", envelope)();
          this.handleMessage(envelope);
          return true;
        }),
        E.getOrElse(() => true),
      );

    sendMessage: <T extends Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void> = <
      T extends Message,
    >(
      envelope: MessageEnvelope<T>,
    ) =>
      TE.tryCatch(
        async () => {
          logger.info("Sending message", envelope)();
          window.postMessage(envelope, "*");
        },
        (error) => {
          logger.error("Failed to send message", error)();
          return postMessageError(`PostMessage failed: ${error}`);
        },
      );
  };

// biome-ignore format: ack
export const WithPostMessageAdapter = <T extends ClassType>(Base: T) =>
  compose(
    Base, 
    WithMessageAdapter, 
    WithPostMessage
);

// Error constructor

export const postMessageError = (message: string): PostMessageError => ({
  type: "PostMessageError",
  message,
});
