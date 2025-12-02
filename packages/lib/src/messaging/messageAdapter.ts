import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../logger";
import { type NotImplementedError, notImplementedError } from "../misc";
import type { ClassType } from "../mixin";
import type { Message } from "./message";
import type { InvalidMessageEnvelopeError, InvalidTargetError, MessageEnvelope } from "./messageEnvelope";
import { validateEnvelope } from "./messageEnvelope";

export type Handler<T extends Message = Message> = (envelope: MessageEnvelope<T>) => IO.IO<void>;

export type NoMessageHandlerRegisteredError = Readonly<{
  type: "NoMessageHandlerRegisteredError";
  message: string;
}>;

export type MessageHandlingError = Readonly<{
  type: "MessageHandlingError";
  message: string;
}>;

export type MessageAdapterError =
  | NoMessageHandlerRegisteredError
  | MessageHandlingError
  | NotImplementedError
  | InvalidMessageEnvelopeError
  | InvalidTargetError;

export interface MessageAdapter {
  registerMessageHandler: (handler: Handler) => IO.IO<void>;
  sendMessage: <T extends Message = Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void>;
  handleMessage: (data: unknown) => E.Either<unknown, void>;
}

const logger = createLogger("MessageAdapter");

export const WithMessageAdapter = <T extends ClassType>(Base: T) =>
  class extends Base implements MessageAdapter {
    messageHandler = IORef.newIORef<O.Option<Handler>>(O.none)();

    registerMessageHandler: (handler: Handler) => IO.IO<void> = (handler) =>
      pipe(
        IO.of({ handler }),
        IO.tap(({ handler }) => this.messageHandler.write(O.some(handler))),
        IO.tap(() => logger.info(`Registered message handler`)),
      );

    handleMessage: (data: unknown) => E.Either<unknown, void> = (data) =>
      pipe(
        validateEnvelope(data),
        E.mapLeft((error) => {
          logger.error("Envelope validation failed", error)();
          return error;
        }),
        E.flatMap((envelope) =>
          pipe(
            this.messageHandler.read(),
            E.fromOption(() => {
              const error = noMessageHandlerRegisteredError("No message handler registered");
              logger.error("No handler registered")();
              return error;
            }),
            E.flatMap((handler) =>
              E.tryCatch(
                () => {
                  logger.info("Dispatching message", envelope.message.type)();
                  handler(envelope)();
                },
                (error) => {
                  logger.error("Handler error", error)();
                  return messageHandlingError(error instanceof Error ? error.message : String(error));
                },
              ),
            ),
          ),
        ),
      );

    sendMessage: <T extends Message = Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void> = (
      _envelope,
    ) => TE.left(notImplementedError("Method not implemented."));
  };

// Error constructors

export const noMessageHandlerRegisteredError = (message: string): NoMessageHandlerRegisteredError => ({
  type: "NoMessageHandlerRegisteredError",
  message,
});

export const messageHandlingError = (message: string): MessageHandlingError => ({
  type: "MessageHandlingError",
  message,
});
