import { type ClassType, createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as RR from "fp-ts/ReadonlyRecord";
import * as S from "fp-ts/State";
import * as TE from "fp-ts/TaskEither";
import type { Message } from "./message";
import type { Handler, MessageAdapter } from "./messageAdapter";
import { createEnvelope, type MessageEnvelope } from "./messageEnvelope";
import type { MessageOrigin } from "./messageOrigin";
import type { MessageType } from "./messageType";

const logger = createLogger("MessageClient");

type ClientState = {
  origin: MessageOrigin;
  handlers: RR.ReadonlyRecord<string, ReadonlyArray<Handler>>;
};

export interface MessageClient extends Pick<ClientState, "origin" | "handlers"> {
  send: <T extends Message>(target: MessageOrigin, message: T) => TE.TaskEither<unknown, void>;
  on: <T extends MessageType>(type: T, handler: Handler<Extract<Message, { type: T }>>) => IO.IO<void>;
  off: <T extends MessageType>(type: T, handler: Handler<Extract<Message, { type: T }>>) => IO.IO<void>;
  once: <T extends MessageType>(
    type: T,
    timeout?: number,
  ) => TE.TaskEither<MessageClientError, MessageEnvelope<Extract<Message, { type: T }>>>;
}

export type MessageClientTimeoutError = Readonly<{
  type: "MessageClientTimeoutError";
  message: string;
  messageType: MessageType;
}>;

export type MessageClientError = MessageClientTimeoutError;

export const WithMessageClient =
  (initialOrigin: MessageOrigin) =>
  <T extends ClassType<MessageAdapter>>(Base: T) =>
    class extends Base implements MessageClient {
      origin: MessageOrigin = initialOrigin;
      handlers: RR.ReadonlyRecord<string, ReadonlyArray<Handler>> = {};

      constructor(...args: any[]) {
        super(...args);
        this.registerMessageHandler(this.dispatch)();
      }

      getClientState: IO.IO<ClientState> = () => ({
        origin: this.origin,
        handlers: this.handlers,
      });

      setClientState =
        (state: ClientState): IO.IO<void> =>
        () => {
          this.origin = state.origin;
          this.handlers = state.handlers;
        };

      runClientState = <A>(stateOp: S.State<ClientState, A>): IO.IO<A> =>
        pipe(
          this.getClientState,
          IO.flatMap((currentState) =>
            pipe(
              IO.of(stateOp(currentState)),
              IO.flatMap(([result, nextState]) =>
                pipe(
                  this.setClientState(nextState),
                  IO.map(() => result),
                ),
              ),
            ),
          ),
        );

      dispatch = (envelope: MessageEnvelope): IO.IO<void> =>
        pipe(
          IO.Do,
          IO.flatMap(() =>
            this.runClientState(
              pipe(
                S.gets((s: ClientState) => s.origin),
                S.flatMap((origin) =>
                  origin !== envelope.target ? S.of(RA.empty) : getHandlers(envelope.message.type),
                ),
              ),
            ),
          ),
          IO.flatMap((handlers) =>
            pipe(
              handlers,
              RA.map((h) => h(envelope)),
              IO.sequenceArray,
              IO.map(() => undefined),
            ),
          ),
        );

      send = <TMsg extends Message>(target: MessageOrigin, message: TMsg): TE.TaskEither<unknown, void> =>
        pipe(
          TE.fromIO(this.getClientState),
          TE.map((state) => createEnvelope(state.origin, target, message)),
          TE.flatMap((envelope) => this.sendMessage(envelope)),
          TE.tapIO(() => logger.debug("Sent message", message.type, "to", target)),
        );

      on = <TT extends MessageType>(type: TT, handler: Handler<Extract<Message, { type: TT }>>): IO.IO<void> =>
        pipe(
          this.runClientState(addHandler(type, handler as Handler)),
          IO.tap(() => logger.debug("Listening to", type)),
        );

      off = <TT extends MessageType>(type: TT, handler: Handler<Extract<Message, { type: TT }>>): IO.IO<void> =>
        pipe(
          this.runClientState(removeHandler(type, handler as Handler)),
          IO.tap(() => logger.debug("Stopped listening to", type)),
        );

      once = <TT extends MessageType>(
        type: TT,
        timeout = 5000,
      ): TE.TaskEither<MessageClientError, MessageEnvelope<Extract<Message, { type: TT }>>> =>
        TE.tryCatch(
          () =>
            new Promise<MessageEnvelope<Extract<Message, { type: TT }>>>((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                this.off(type, handler)();
                reject(messageClientTimeoutError(type, timeout));
              }, timeout);

              const handler: Handler<Extract<Message, { type: TT }>> = (envelope) => () => {
                clearTimeout(timeoutId);
                this.off(type, handler)();
                resolve(envelope);
              };

              this.on(type, handler)();
            }),
          (error) =>
            error instanceof Error && "messageType" in error
              ? (error as unknown as MessageClientError)
              : messageClientTimeoutError(type, timeout),
        );
    };

const getHandlers = (type: string): S.State<ClientState, ReadonlyArray<Handler>> =>
  pipe(
    S.gets((state: ClientState) => state.handlers),
    S.map((handlers) =>
      pipe(
        handlers,
        RR.lookup(type),
        O.getOrElse((): ReadonlyArray<Handler> => RA.empty),
      ),
    ),
  );

const modifyHandlers = (
  type: string,
  f: (hs: ReadonlyArray<Handler>) => ReadonlyArray<Handler>,
): S.State<ClientState, void> =>
  pipe(
    getHandlers(type),
    S.flatMap((current) =>
      S.modify((state: ClientState) => ({
        ...state,
        handlers: pipe(state.handlers, RR.upsertAt(type, f(current))),
      })),
    ),
  );

const addHandler = (type: MessageType, handler: Handler): S.State<ClientState, void> =>
  modifyHandlers(type, RA.append(handler));

const removeHandler = (type: MessageType, handler: Handler): S.State<ClientState, void> =>
  modifyHandlers(
    type,
    RA.filter((h) => h !== handler),
  );

export const messageClientTimeoutError = (messageType: MessageType, timeoutMs: number): MessageClientTimeoutError => ({
  type: "MessageClientTimeoutError",
  message: `Waiting for ${messageType} timed out after ${timeoutMs}ms`,
  messageType,
});
