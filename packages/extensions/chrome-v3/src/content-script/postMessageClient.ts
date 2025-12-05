import type { ClassType } from "@hbb-emu/core";
import { createEnvelope, type MessageEnvelope, type MessageOrigin } from "@hbb-emu/core/message-bus";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import { type MessageTimeoutError, messageTimeoutError } from "./errors";
import type { PostMessageAdapter } from "./postMessageAdapter";

type MessageHandler = (envelope: MessageEnvelope) => void;
type HandlersRecord = Record<string, ReadonlyArray<MessageHandler>>;

export interface PostMessageClient {
  handlers: HandlersRecord;
  on: <T extends string>(type: T, handler: (envelope: MessageEnvelope) => IO.IO<void>) => IO.IO<void>;
  off: <T extends string>(type: T, handler: (envelope: MessageEnvelope) => IO.IO<void>) => IO.IO<void>;
  send: (target: MessageOrigin, message: { type: string; payload: unknown }) => IO.IO<void>;
  once: <T extends string>(type: T, timeout?: number) => TE.TaskEither<MessageTimeoutError, MessageEnvelope>;
}

export const WithPostMessageClient = <T extends ClassType<PostMessageAdapter>>(Base: T) =>
  class extends Base implements PostMessageClient {
    handlers: HandlersRecord = {};

    override handleIncomingMessage = (envelope: MessageEnvelope): void => {
      const handlers = getHandlers(this.handlers, envelope.message.type);
      pipe(
        handlers,
        RA.map((h) => h(envelope)),
      );
    };

    on =
      <TT extends string>(type: TT, handler: (envelope: MessageEnvelope) => IO.IO<void>): IO.IO<void> =>
      () => {
        const wrappedHandler: MessageHandler = (envelope) => handler(envelope)();
        this.handlers = addHandler(this.handlers, type, wrappedHandler);
      };

    off =
      <TT extends string>(type: TT, handler: (envelope: MessageEnvelope) => IO.IO<void>): IO.IO<void> =>
      () => {
        const wrappedHandler: MessageHandler = (envelope) => handler(envelope)();
        this.handlers = removeHandler(this.handlers, type, wrappedHandler);
      };

    send =
      (target: MessageOrigin, message: { type: string; payload: unknown }): IO.IO<void> =>
      () => {
        const envelope = createEnvelope("CONTENT_SCRIPT", target, message as MessageEnvelope["message"]);
        this.sendViaPostMessage(envelope);
      };

    once = <TT extends string>(type: TT, timeout = 5000): TE.TaskEither<MessageTimeoutError, MessageEnvelope> =>
      TE.tryCatch(
        () =>
          new Promise<MessageEnvelope>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              this.handlers = removeHandler(this.handlers, type, handler);
              reject(messageTimeoutError(type, timeout));
            }, timeout);

            const handler: MessageHandler = (envelope) => {
              if (envelope.message.type === type) {
                clearTimeout(timeoutId);
                this.handlers = removeHandler(this.handlers, type, handler);
                resolve(envelope);
              }
            };

            this.handlers = addHandler(this.handlers, type, handler);
          }),
        (e): MessageTimeoutError =>
          e instanceof Error && e.message.includes("Timeout")
            ? messageTimeoutError(type, timeout)
            : messageTimeoutError(type, timeout),
      );
  };

const getHandlers = (handlers: HandlersRecord, type: string): ReadonlyArray<MessageHandler> =>
  pipe(
    O.fromNullable(handlers[type]),
    O.getOrElse((): ReadonlyArray<MessageHandler> => RA.empty),
  );

const addHandler = (handlers: HandlersRecord, type: string, handler: MessageHandler): HandlersRecord => ({
  ...handlers,
  [type]: RA.append(handler)(getHandlers(handlers, type)),
});

const removeHandler = (handlers: HandlersRecord, type: string, handler: MessageHandler): HandlersRecord => ({
  ...handlers,
  [type]: RA.filter((h: MessageHandler) => h !== handler)(getHandlers(handlers, type)),
});
