import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../logger";
import type { ClassType } from "../mixin";
import type { Message } from "./message";
import type { InvalidMessageEnvelopeError, InvalidTargetError, MessageEnvelope } from "./messageEnvelope";
import { validateEnvelope } from "./messageEnvelope";
import type { MessageOrigin } from "./messageOrigin";

export interface MessageAdapter {
  registerMessageBus: RegisterMessageBus;
  sendMessage<T extends Message>(envelope: MessageEnvelope<T>): TE.TaskEither<unknown, void>;
  handleMessage(data: unknown): E.Either<unknown, void>;
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

    handleMessage = (data: unknown): E.Either<unknown, void> =>
      pipe(
        validateEnvelope(data),
        E.flatMap((envelope) =>
          pipe(
            this.messageHandler,
            O.match(
              (): E.Either<unknown, void> => E.left(noMessageHandlerRegisteredError("No message handler registered")),
              (handler): E.Either<unknown, void> =>
                E.tryCatch(
                  () => {
                    handler(envelope);
                  },
                  (error) => messageHandlingError(error instanceof Error ? error.message : String(error)),
                ),
            ),
          ),
        ),
        E.mapLeft((error) => {
          logger.error("Message handling failed", error)();
          return error;
        }),
      );

    sendMessage = <T extends Message>(_envelope: MessageEnvelope<T>): TE.TaskEither<unknown, void> =>
      TE.left(methodNotImplementedError("Method not implemented."));
  };

//  Errors

export type NoMessageHandlerRegisteredError = Readonly<{
  type: "NoMessageHandlerRegisteredError";
  message: string;
}>;

export type MessageHandlingError = Readonly<{
  type: "MessageHandlingError";
  message: string;
}>;

export type MethodNotImplementedError = Readonly<{
  type: "MethodNotImplementedError";
  message: string;
}>;

export const noMessageHandlerRegisteredError = (message: string): NoMessageHandlerRegisteredError => ({
  type: "NoMessageHandlerRegisteredError",
  message,
});

export const messageHandlingError = (message: string): MessageHandlingError => ({
  type: "MessageHandlingError",
  message,
});

export const methodNotImplementedError = (message: string): MethodNotImplementedError => ({
  type: "MethodNotImplementedError",
  message,
});

export type MessageAdapterError =
  | NoMessageHandlerRegisteredError
  | MessageHandlingError
  | MethodNotImplementedError
  | InvalidMessageEnvelopeError
  | InvalidTargetError;
