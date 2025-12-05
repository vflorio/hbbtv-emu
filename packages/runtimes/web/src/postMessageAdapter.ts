import { type ClassType, compose, createLogger } from "@hbb-emu/core";
import {
  isMessageEnvelope,
  type Message,
  type MessageAdapter,
  type MessageEnvelope,
  WithMessageAdapter,
} from "@hbb-emu/core/message-bus";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOO from "fp-ts/IOOption";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as RS from "fp-ts/ReadonlySet";
import * as S from "fp-ts/State";
import * as Str from "fp-ts/string";
import * as TE from "fp-ts/TaskEither";

const logger = createLogger("PostMessageAdapter");

export type PostMessageError = Readonly<{
  type: "PostMessageError";
  message: string;
}>;

export const postMessageError = (message: string): PostMessageError => ({
  type: "PostMessageError",
  message,
});

type AdapterState = Readonly<{
  processedIds: ReadonlySet<string>;
}>;

export interface PostMessageAdapter extends MessageAdapter {
  sendMessage: <T extends Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<PostMessageError, void>;
}

const WithPostMessage = <T extends ClassType<MessageAdapter>>(Base: T) =>
  class extends Base implements PostMessageAdapter {
    adapterState: AdapterState = {
      processedIds: RS.empty,
    };

    constructor(...args: any[]) {
      super(...args);
      window.addEventListener("message", this.handlePostMessage);
    }

    handlePostMessage = (event: MessageEvent) =>
      pipe(
        IOO.fromPredicate(isFromWindow)(event),
        IOO.flatMap((e) => IOO.fromOption(extractEnvelope(e))),
        IOO.filter(isNotSelfMessage),
        IOO.flatMap((envelope) =>
          pipe(
            IOO.fromIO(runState(this, isAlreadyProcessed(envelope.id))),
            IOO.filter((alreadyProcessed) => !alreadyProcessed),
            IOO.map(() => envelope),
          ),
        ),
        IOO.flatMapIO((envelope) =>
          pipe(
            runState(this, addProcessedId(envelope.id)),
            IO.flatMap(() => () => this.handleMessage(envelope)),
          ),
        ),
      )();

    override sendMessage = <TMsg extends Message>(
      envelope: MessageEnvelope<TMsg>,
    ): TE.TaskEither<PostMessageError, void> =>
      pipe(
        TE.tryCatch(
          () => Promise.resolve(sendViaPostMessage(envelope)()),
          (error): PostMessageError => postMessageError(error instanceof Error ? error.message : String(error)),
        ),
        TE.tapIO(() => logger.debug("Sent message via postMessage:", envelope.message.type)),
      );
  };

const MAX_PROCESSED_IDS = 1024;

const runState =
  <A>(holder: { adapterState: AdapterState }, op: S.State<AdapterState, A>): IO.IO<A> =>
  () => {
    const [result, nextState] = op(holder.adapterState);
    holder.adapterState = nextState;
    return result;
  };

const isAlreadyProcessed = (id: string): S.State<AdapterState, boolean> =>
  S.gets((s) => RS.elem(Str.Eq)(id)(s.processedIds));

const addProcessedId = (id: string): S.State<AdapterState, void> =>
  S.modify((s) => ({
    ...s,
    processedIds: pipe(
      s.processedIds,
      RS.insert(Str.Eq)(id),
      // Prevent memory leak
      (ids) =>
        RS.size(ids) > MAX_PROCESSED_IDS
          ? pipe(ids, RS.toReadonlyArray(Str.Ord), RA.dropLeft(1), RS.fromReadonlyArray(Str.Eq))
          : ids,
    ),
  }));

const isFromWindow = (event: MessageEvent): boolean => event.source === window;

const extractEnvelope = (event: MessageEvent): O.Option<MessageEnvelope> =>
  pipe(
    O.fromPredicate(isMessageEnvelope)(event.data),
    O.map((data) => data as MessageEnvelope),
  );

const isNotSelfMessage = (envelope: MessageEnvelope): boolean => envelope.source !== envelope.target;

const sendViaPostMessage =
  <T extends Message>(envelope: MessageEnvelope<T>): IO.IO<void> =>
  () =>
    window.postMessage(envelope, "*");

// biome-ignore format: composition
export const WithPostMessageAdapter = <T extends ClassType>(Base: T) =>
  compose(
    Base,
    WithMessageAdapter,
    WithPostMessage,
  );
