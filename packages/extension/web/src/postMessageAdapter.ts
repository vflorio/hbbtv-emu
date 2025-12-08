import { type ClassType, compose, createLogger } from "@hbb-emu/core";
import {
  isMessageEnvelope,
  type Message,
  type MessageAdapter,
  type MessageEnvelope,
  WithMessageAdapter,
} from "@hbb-emu/core/message-bus";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as IOO from "fp-ts/IOOption";
import * as O from "fp-ts/Option";
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

export interface PostMessageAdapter extends MessageAdapter {
  sendMessage: <T extends Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<PostMessageError, void>;
}

const WithPostMessage = <T extends ClassType<MessageAdapter>>(Base: T) =>
  class extends Base implements PostMessageAdapter {
    constructor(...args: any[]) {
      super(...args);
      window.addEventListener("message", this.handlePostMessage);
    }

    handlePostMessage = (event: MessageEvent) =>
      pipe(
        IOO.of(event),
        IOO.filter(isFromSamePage),
        IOO.flatMap((e) => IOO.fromOption(extractEnvelope(e))),
        IOO.filter(isNotSelfMessage),
        IOO.flatMap((envelope) => IOO.fromIOEither(this.handleMessage(envelope))),
      )();

    override sendMessage = <TMsg extends Message>(
      envelope: MessageEnvelope<TMsg>,
    ): TE.TaskEither<PostMessageError, void> =>
      pipe(
        TE.fromIO(postMessage(envelope)),
        TE.mapError((error) => postMessageError(String(error))),
        TE.tapIO(() => logger.debug("Sent message via postMessage:", envelope.message.type)),
      );
  };

export const isFromSamePage = (event: MessageEvent): boolean => {
  // Accept messages from the same page (same origin)
  // In Chrome extensions, MAIN world and ISOLATED world have different window objects
  // but they share the same origin, so we check origin instead of event.source === window
  if (event.origin !== location.origin) {
    return false;
  }
  return event.source != null;
};

const isNotSelfMessage = (envelope: MessageEnvelope): boolean => envelope.source !== envelope.target;

const extractEnvelope = (event: MessageEvent): O.Option<MessageEnvelope> =>
  pipe(
    O.fromPredicate(isMessageEnvelope)(event.data),
    O.map((data) => data as MessageEnvelope),
  );

const postMessage =
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
