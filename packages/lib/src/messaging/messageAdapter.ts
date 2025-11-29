import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../logger";
import { type NotImplementedError, notImplementedError } from "../misc";
import type { ClassType } from "../mixin";
import type { Message } from "./message";
import type { InvalidMessageEnvelopeError, InvalidTargetError, MessageEnvelope } from "./messageEnvelope";
import { validateEnvelope } from "./messageEnvelope";
import type { MessageOrigin } from "./messageOrigin";

export namespace MessageAdapter {
  export interface Type {
    registerMessageHandler: RegisterMessageHandler;
    sendMessage: SendMessage;
    handleMessage: HandleMessage;
  }

  export type Error =
    | NoMessageHandlerRegisteredError
    | MessageHandlingError
    | NotImplementedError
    | InvalidMessageEnvelopeError
    | InvalidTargetError;

  export type Handler<T extends Message = Message> = (envelope: MessageEnvelope<T>) => void;
  export type RegisterMessageHandler = (origin: MessageOrigin, handler: Handler) => IO.IO<void>;
  export type SendMessage = <T extends Message = Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void>;
  export type HandleMessage = (data: unknown) => E.Either<unknown, void>;

  export type NoMessageHandlerRegisteredError = Readonly<{
    type: "NoMessageHandlerRegisteredError";
    message: string;
  }>;

  export type MessageHandlingError = Readonly<{
    type: "MessageHandlingError";
    message: string;
  }>;
}

const logger = createLogger("MessageAdapter");

export const WithMessageAdapter = <T extends ClassType>(Base: T) =>
  class extends Base implements MessageAdapter.Type {
    messageOrigin: O.Option<MessageOrigin> = O.none;
    messageHandler: O.Option<MessageAdapter.Handler> = O.none;

    registerMessageHandler: MessageAdapter.RegisterMessageHandler = (origin, handler) =>
      pipe(
        IO.of({ origin, handler }),
        IO.tap(({ origin }) => () => {
          this.messageOrigin = O.some(origin);
        }),
        IO.tap(({ handler }) => () => {
          this.messageHandler = O.some(handler);
        }),
        IO.tap(() => logger.info(`Registered message bus for origin: ${origin}`)),
      );

    handleMessage: MessageAdapter.HandleMessage = (data) =>
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
      );

    sendMessage: MessageAdapter.SendMessage = (_envelope) => TE.left(notImplementedError("Method not implemented."));
  };

//  Errors

export const noMessageHandlerRegisteredError = (message: string): MessageAdapter.NoMessageHandlerRegisteredError => ({
  type: "NoMessageHandlerRegisteredError",
  message,
});

export const messageHandlingError = (message: string): MessageAdapter.MessageHandlingError => ({
  type: "MessageHandlingError",
  message,
});
