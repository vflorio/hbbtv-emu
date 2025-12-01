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
import type { MessageOrigin } from "./messageOrigin";

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
  registerMessageHandler: (origin: MessageOrigin) => (handler: Handler) => IO.IO<void>;
  sendMessage: <T extends Message = Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void>;
  handleMessage: (data: unknown) => E.Either<unknown, void>;
}

const logger = createLogger("MessageAdapter");

export const WithMessageAdapter = <T extends ClassType>(Base: T) =>
  class extends Base implements MessageAdapter {
    messageOrigin = IORef.newIORef<O.Option<MessageOrigin>>(O.none)();
    messageHandler = IORef.newIORef<O.Option<Handler>>(O.none)();

    registerMessageHandler: (origin: MessageOrigin) => (handler: Handler) => IO.IO<void> = (origin) => (handler) =>
      pipe(
        IO.of({ origin, handler }),
        IO.tap(({ origin }) => this.messageOrigin.write(O.some(origin))),
        IO.tap(({ handler }) => this.messageHandler.write(O.some(handler))),
        IO.tap(() => logger.info(`Registered message bus for origin: ${origin}`)),
      );

    handleMessage: (data: unknown) => E.Either<unknown, void> = (data) =>
      pipe(
        validateEnvelope(data),
        E.flatMap((envelope) =>
          pipe(
            this.messageHandler.read(),
            E.fromOption(() => noMessageHandlerRegisteredError("No message handler registered")),
            E.flatMap((handler) =>
              E.tryCatch(
                () => {
                  handler(envelope)();
                },
                (error) => messageHandlingError(error instanceof Error ? error.message : String(error)),
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
