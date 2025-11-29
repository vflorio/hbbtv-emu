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

const WithPostMessage = <T extends ClassType<MessageAdapter.Type>>(Base: T) =>
  class extends Base implements MessageAdapter.Type {
    constructor(...args: any[]) {
      super(...args);
      window.addEventListener("message", this.handlePostMessage);
    }

    handlePostMessage = (event: MessageEvent<MessageEnvelope>): boolean =>
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

    sendMessage = <T extends Message>(
      envelope: MessageEnvelope<T>,
    ): TE.TaskEither<MessageAdapter.Error | PostMessageError, void> =>
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

// Errors

export type PostMessageError = Readonly<{
  type: "PostMessageError";
  message: string;
}>;

export const postMessageError = (message: string): PostMessageError => ({
  type: "PostMessageError",
  message,
});
