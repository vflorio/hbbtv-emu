import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../logger";
import type { ClassType } from "../mixin";
import type { Message, MessageOrigin } from "./message";
import { type MessageEnvelope, validateEnvelope } from "./messageEnvelope";

export interface MessageAdapter {
  registerMessageBus: RegisterMessageBus;
  sendMessage<T extends Message>(envelope: MessageEnvelope<T>): TE.TaskEither<Error, void>;
  handleMessage(data: unknown): E.Either<Error, void>;
}

export type RegisterMessageBus = (origin: MessageOrigin, handler: MessageHandler) => void;

export type MessageHandler<T extends Message = Message> = (envelope: MessageEnvelope<T>) => void;

const logger = createLogger("Message Adapter");

export const WithMessageAdapter = <T extends ClassType>(Base: T) =>
  class extends Base implements MessageAdapter {
    messageOrigin: O.Option<MessageOrigin> = O.none;
    messageHandler: O.Option<MessageHandler> = O.none;

    registerMessageBus = (origin: MessageOrigin, handler: MessageHandler) => {
      this.messageOrigin = O.some(origin);
      this.messageHandler = O.some(handler);
    };

    handleMessage = (data: unknown): E.Either<Error, void> =>
      pipe(
        validateEnvelope(data),
        E.flatMap((envelope) =>
          pipe(
            this.messageHandler,
            O.match(
              () => E.left(new Error("No message handler registered")),
              (handler) =>
                E.tryCatch(
                  () => {
                    handler(envelope);
                  },
                  (error) => (error instanceof Error ? error : new Error(String(error))),
                ),
            ),
          ),
        ),
        E.mapLeft((error) => {
          logger.error("Message handling failed", error);
          return error;
        }),
      );

    sendMessage = <T extends Message>(_envelope: MessageEnvelope<T>): TE.TaskEither<Error, void> =>
      TE.left(new Error("Method not implemented."));
  };
