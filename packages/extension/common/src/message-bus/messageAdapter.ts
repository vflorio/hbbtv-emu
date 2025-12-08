import { type ClassType, createLogger, type NotImplementedError, notImplementedError } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOE from "fp-ts/IOEither";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
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
  handleMessage: (data: unknown) => IOE.IOEither<MessageAdapterError, void>;
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

    handleMessage = (data: unknown): IOE.IOEither<MessageAdapterError, void> =>
      pipe(
        IOE.Do,
        IOE.apS("envelope", getEnvelope(data)),
        IOE.bind("handler", () => getHandler(this.messageHandler)),
        IOE.flatMap(({ envelope, handler }) =>
          IOE.tryCatch(
            () => handler(envelope)(),
            (error): MessageAdapterError =>
              messageHandlingError(error instanceof Error ? error.message : String(error)),
          ),
        ),
        IOE.tapError((error) => IOE.fromIO(logger.error("Handler error", error))),
      );

    sendMessage: <T extends Message = Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void> = (
      _envelope,
    ) => TE.left(notImplementedError("Method not implemented."));
  };

const getHandler = (messageHandler: IORef.IORef<O.Option<Handler>>): IOE.IOEither<MessageAdapterError, Handler> =>
  pipe(
    IOE.fromIO(messageHandler.read),
    IOE.flatMap(IOE.fromOption(() => noMessageHandlerRegisteredError("No message handler registered."))),
    IOE.tapError((error) => IOE.fromIO(logger.error("error: ", error))),
    IOE.mapLeft((error) => error),
  );

const getEnvelope = (data: unknown): IOE.IOEither<MessageAdapterError, MessageEnvelope> =>
  pipe(
    validateEnvelope(data),
    IOE.fromEither,
    IOE.mapLeft((error) => error),
  );

// Error constructors

export const noMessageHandlerRegisteredError = (message: string): NoMessageHandlerRegisteredError => ({
  type: "NoMessageHandlerRegisteredError",
  message,
});

export const messageHandlingError = (message: string): MessageHandlingError => ({
  type: "MessageHandlingError",
  message,
});
