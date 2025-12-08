import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as RR from "fp-ts/ReadonlyRecord";
import * as S from "fp-ts/State";
import type { ClassType } from "../lib/mixin";
import type { Message } from "./message";
import type { Handler, MessageAdapter } from "./messageAdapter";
import type { MessageEnvelope } from "./messageEnvelope";
import type { MessageOrigin } from "./messageOrigin";
import type { MessageType } from "./messageType";

type State = {
  origin: MessageOrigin;
  handlers: RR.ReadonlyRecord<string, ReadonlyArray<Handler>>;
};

interface MessageBus extends State {
  bus: {
    on: <T extends MessageType>(type: T, handler: Handler<Extract<Message, { type: T }>>) => IO.IO<void>;
    off: <T extends MessageType>(type: T, handler: Handler<Extract<Message, { type: T }>>) => IO.IO<void>;
    dispatch: (envelope: MessageEnvelope) => IO.IO<void>;
  };
}

export const WithMessageBus =
  (initialOrigin: MessageOrigin) =>
  <T extends ClassType<MessageAdapter>>(Base: T) =>
    class extends Base implements MessageBus {
      origin: MessageOrigin = initialOrigin;
      handlers: RR.ReadonlyRecord<string, ReadonlyArray<Handler>> = {};

      constructor(...args: any[]) {
        super(...args);
        this.registerMessageHandler(this.bus.dispatch)();
      }

      getBusState: IO.IO<State> = () => ({
        origin: this.origin,
        handlers: this.handlers,
      });

      setBusState =
        (state: State): IO.IO<void> =>
        () => {
          this.origin = state.origin;
          this.handlers = state.handlers;
        };

      // esegue una State monad trasformandola in IO
      runBusState = <A>(stateOp: S.State<State, A>): IO.IO<A> =>
        pipe(
          this.getBusState,
          IO.flatMap((currentState) =>
            pipe(
              IO.of(stateOp(currentState)),
              IO.flatMap(([result, nextState]) =>
                pipe(
                  this.setBusState(nextState),
                  IO.map(() => result),
                ),
              ),
            ),
          ),
        );

      bus = {
        on: <TT extends MessageType>(type: TT, handler: Handler<Extract<Message, { type: TT }>>): IO.IO<void> =>
          this.runBusState(on(type, handler as Handler)),

        off: <TT extends MessageType>(type: TT, handler: Handler<Extract<Message, { type: TT }>>): IO.IO<void> =>
          this.runBusState(off(type, handler as Handler)),

        dispatch: (envelope: MessageEnvelope): IO.IO<void> => pipe(this.runBusState(dispatch(envelope)), IO.flatten),
      };
    };

const getHandlers = (type: string): S.State<State, ReadonlyArray<Handler>> =>
  pipe(
    S.gets((state: State) => state.handlers),
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
): S.State<State, void> =>
  pipe(
    getHandlers(type),
    S.flatMap((current) =>
      S.modify((state: State) => ({
        ...state,
        handlers: pipe(state.handlers, RR.upsertAt(type, f(current))),
      })),
    ),
  );

const on = (type: MessageType, handler: Handler): S.State<State, void> => modifyHandlers(type, RA.append(handler));

const off = (type: MessageType, handler: Handler): S.State<State, void> =>
  modifyHandlers(
    type,
    RA.filter((h) => h !== handler),
  );

const dispatch = (envelope: MessageEnvelope): S.State<State, IO.IO<void>> =>
  pipe(
    S.gets((s: State) => s.origin),
    S.flatMap((origin) =>
      origin !== envelope.target
        ? S.of(IO.of(undefined))
        : pipe(
            getHandlers(envelope.message.type),
            S.map((hs) =>
              pipe(
                hs,
                RA.map((h) => h(envelope)),
                IO.sequenceArray,
                IO.map(() => undefined),
              ),
            ),
          ),
    ),
  );
