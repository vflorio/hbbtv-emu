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
import { type BackgroundScriptMessageContext, createEnvelope, type MessageEnvelope } from "./messageEnvelope";
import type { MessageOrigin } from "./messageOrigin";
import type { MessageType } from "./messageType";

const logger = createLogger("MessageBroker");

type BrokerState = {
  origin: MessageOrigin;
  handlers: RR.ReadonlyRecord<string, ReadonlyArray<Handler>>;
  pendingRequests: RR.ReadonlyRecord<string, PendingRequest>;
};

type PendingRequest = {
  resolve: (envelope: MessageEnvelope) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

export type RequestTimeoutError = Readonly<{
  type: "RequestTimeoutError";
  message: string;
  requestId: string;
}>;

export type MessageBrokerError = RequestTimeoutError;

export interface MessageBroker extends Pick<BrokerState, "origin" | "handlers"> {
  // Fire-and-forget message (context is optional for targeting specific tabs)
  publish: <T extends Message>(
    target: MessageOrigin,
    message: T,
    context?: BackgroundScriptMessageContext,
  ) => TE.TaskEither<unknown, void>;
  // Request-response message
  request: <TReq extends Message, TRes extends Message>(
    target: MessageOrigin,
    message: TReq,
    timeout?: number,
  ) => TE.TaskEither<MessageBrokerError, MessageEnvelope<TRes>>;
  // Subscription management
  subscribe: <T extends MessageType>(type: T, handler: Handler<Extract<Message, { type: T }>>) => IO.IO<void>;
  unsubscribe: <T extends MessageType>(type: T, handler: Handler<Extract<Message, { type: T }>>) => IO.IO<void>;
  // Reply to a message
  reply: <T extends Message>(originalEnvelope: MessageEnvelope, message: T) => TE.TaskEither<unknown, void>;
}

export const WithMessageBroker =
  (initialOrigin: MessageOrigin) =>
  <T extends ClassType<MessageAdapter>>(Base: T) =>
    class extends Base implements MessageBroker {
      origin: MessageOrigin = initialOrigin;
      handlers: RR.ReadonlyRecord<string, ReadonlyArray<Handler>> = {};
      pendingRequests: RR.ReadonlyRecord<string, PendingRequest> = {};

      constructor(...args: any[]) {
        super(...args);
        this.registerMessageHandler(this.dispatch)();
      }

      // State management
      getBrokerState: IO.IO<BrokerState> = () => ({
        origin: this.origin,
        handlers: this.handlers,
        pendingRequests: this.pendingRequests,
      });

      setBrokerState =
        (state: BrokerState): IO.IO<void> =>
        () => {
          this.origin = state.origin;
          this.handlers = state.handlers;
          this.pendingRequests = state.pendingRequests;
        };

      runBrokerState = <A>(stateOp: S.State<BrokerState, A>): IO.IO<A> =>
        pipe(
          this.getBrokerState,
          IO.flatMap((currentState) =>
            pipe(
              IO.of(stateOp(currentState)),
              IO.flatMap(([result, nextState]) =>
                pipe(
                  this.setBrokerState(nextState),
                  IO.map(() => result),
                ),
              ),
            ),
          ),
        );

      // Dispatch incoming messages
      dispatch = (envelope: MessageEnvelope): IO.IO<void> =>
        pipe(
          this.runBrokerState(
            pipe(
              S.gets((s: BrokerState) => s.origin),
              S.flatMap(
                (origin): S.State<BrokerState, { shouldProcess: boolean; isPendingResponse: boolean }> =>
                  origin !== envelope.target
                    ? S.of({ shouldProcess: false, isPendingResponse: false })
                    : pipe(
                        S.gets((s: BrokerState) => s.pendingRequests),
                        S.map((pending) => ({
                          shouldProcess: true,
                          isPendingResponse: RR.has(envelope.id, pending),
                        })),
                      ),
              ),
            ),
          ),
          IO.flatMap(({ shouldProcess, isPendingResponse }) => {
            if (!shouldProcess) return IO.of(undefined);

            if (isPendingResponse) {
              return this.runBrokerState(resolvePendingRequest(envelope));
            }

            return pipe(
              this.runBrokerState(getHandlers(envelope.message.type)),
              IO.flatMap((handlers) =>
                pipe(
                  handlers,
                  RA.map((h) => h(envelope)),
                  IO.sequenceArray,
                  IO.map(() => undefined),
                ),
              ),
            );
          }),
        );

      // Public API
      publish = <TMsg extends Message>(
        target: MessageOrigin,
        message: TMsg,
        context?: BackgroundScriptMessageContext,
      ): TE.TaskEither<unknown, void> =>
        pipe(
          TE.fromIO(this.getBrokerState),
          TE.map((state) => createEnvelope(state.origin, target, message, context)),
          TE.flatMap((envelope) => this.sendMessage(envelope)),
          TE.tapIO(() => logger.debug("Published message", message.type, "to", target)),
        );

      request = <TReq extends Message, TRes extends Message>(
        target: MessageOrigin,
        message: TReq,
        timeout = 5000,
      ): TE.TaskEither<MessageBrokerError, MessageEnvelope<TRes>> =>
        pipe(
          TE.fromIO(this.getBrokerState),
          TE.map((state) => createEnvelope(state.origin, target, message)),
          TE.flatMap((envelope) =>
            pipe(
              TE.tryCatch(
                () =>
                  new Promise<MessageEnvelope<TRes>>((resolve, reject) => {
                    const timeoutId = setTimeout(() => {
                      this.runBrokerState(removePendingRequest(envelope.id))();
                      reject(requestTimeoutError(envelope.id, timeout));
                    }, timeout);

                    const pendingRequest: PendingRequest = {
                      resolve: resolve as (e: MessageEnvelope) => void,
                      reject,
                      timeoutId,
                    };

                    this.runBrokerState(addPendingRequest(envelope.id, pendingRequest))();
                    this.sendMessage(envelope)();
                  }),
                (error) =>
                  error instanceof Error && error.message.includes("timeout")
                    ? (error as unknown as RequestTimeoutError)
                    : requestTimeoutError(envelope.id, timeout),
              ),
            ),
          ),
          TE.tapIO(() => logger.debug("Request sent", message.type, "to", target)),
        );

      subscribe = <TT extends MessageType>(type: TT, handler: Handler<Extract<Message, { type: TT }>>): IO.IO<void> =>
        pipe(
          this.runBrokerState(addHandler(type, handler as Handler)),
          IO.tap(() => logger.debug("Subscribed to", type)),
        );

      unsubscribe = <TT extends MessageType>(type: TT, handler: Handler<Extract<Message, { type: TT }>>): IO.IO<void> =>
        pipe(
          this.runBrokerState(removeHandler(type, handler as Handler)),
          IO.tap(() => logger.debug("Unsubscribed from", type)),
        );

      reply = <TMsg extends Message>(originalEnvelope: MessageEnvelope, message: TMsg): TE.TaskEither<unknown, void> =>
        pipe(
          TE.fromIO(this.getBrokerState),
          TE.map((state) =>
            // Use original envelope ID for correlation, preserve context for routing
            ({
              ...createEnvelope(state.origin, originalEnvelope.source, message, originalEnvelope.context),
              id: originalEnvelope.id,
            }),
          ),
          TE.flatMap((envelope) => this.sendMessage(envelope)),
          TE.tapIO(() => logger.debug("Replied to", originalEnvelope.id, "with", message.type)),
        );
    };

// State Operations

const getHandlers = (type: string): S.State<BrokerState, ReadonlyArray<Handler>> =>
  pipe(
    S.gets((state: BrokerState) => state.handlers),
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
): S.State<BrokerState, void> =>
  pipe(
    getHandlers(type),
    S.flatMap((current) =>
      S.modify((state: BrokerState) => ({
        ...state,
        handlers: pipe(state.handlers, RR.upsertAt(type, f(current))),
      })),
    ),
  );

const addHandler = (type: MessageType, handler: Handler): S.State<BrokerState, void> =>
  modifyHandlers(type, RA.append(handler));

const removeHandler = (type: MessageType, handler: Handler): S.State<BrokerState, void> =>
  modifyHandlers(
    type,
    RA.filter((h) => h !== handler),
  );

const addPendingRequest = (id: string, request: PendingRequest): S.State<BrokerState, void> =>
  S.modify((state) => ({
    ...state,
    pendingRequests: pipe(state.pendingRequests, RR.upsertAt(id, request)),
  }));

const removePendingRequest = (id: string): S.State<BrokerState, void> =>
  S.modify((state) => ({
    ...state,
    pendingRequests: pipe(state.pendingRequests, RR.deleteAt(id)),
  }));

const resolvePendingRequest = (envelope: MessageEnvelope): S.State<BrokerState, void> =>
  pipe(
    S.gets((state: BrokerState) => state.pendingRequests),
    S.flatMap((pending) =>
      pipe(
        pending,
        RR.lookup(envelope.id),
        O.match(
          () => S.of<BrokerState, void>(undefined),
          (request) =>
            pipe(
              S.modify<BrokerState>((state) => ({
                ...state,
                pendingRequests: pipe(state.pendingRequests, RR.deleteAt(envelope.id)),
              })),
              S.map(() => {
                clearTimeout(request.timeoutId);
                return request.resolve(envelope);
              }),
            ),
        ),
      ),
    ),
  );

// Error Constructors

export const requestTimeoutError = (requestId: string, timeoutMs: number): RequestTimeoutError => ({
  type: "RequestTimeoutError",
  message: `Request ${requestId} timed out after ${timeoutMs}ms`,
  requestId,
});
