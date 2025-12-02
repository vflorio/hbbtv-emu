import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../../logger";
import { type ClassType, compose } from "../../mixin";
import type { Message } from "../message";
import { type MessageAdapter, WithMessageAdapter } from "../messageAdapter";
import type { MessageEnvelope } from "../messageEnvelope";

const logger = createLogger("PostMessageAdapter");

export type PostMessageError = Readonly<{
  type: "PostMessageError";
  message: string;
}>;

export interface PostMessageAdapter extends MessageAdapter {
  handlePostMessage: (event: MessageEvent<MessageEnvelope>) => boolean;
  sendMessage: <T extends Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void>;
}

const WithPostMessage = <T extends ClassType<MessageAdapter>>(Base: T) =>
  class extends Base implements PostMessageAdapter {
    processedMessageIds = new Set<string>();
    readonly MAX_PROCESSED_IDS = 100;

    constructor(...args: any[]) {
      super(...args);
      window.addEventListener("message", this.handlePostMessage);
    }

    markAsProcessed(id: string): void {
      this.processedMessageIds.add(id);
      // Prevent memory leak by limiting the size of the set
      if (this.processedMessageIds.size > this.MAX_PROCESSED_IDS) {
        const firstId = this.processedMessageIds.values().next().value;
        if (firstId) this.processedMessageIds.delete(firstId);
      }
    }

    handlePostMessage: (event: MessageEvent<MessageEnvelope>) => boolean = (event) => {
      return pipe(
        event.data,
        E.fromPredicate(
          (data): data is MessageEnvelope =>
            data &&
            typeof data === "object" &&
            "source" in data &&
            "target" in data &&
            "message" in data &&
            "id" in data,
          () => true,
        ),
        E.flatMap((envelope) =>
          pipe(
            envelope,
            E.fromPredicate(
              (env) => env.source !== env.target,
              () => true,
            ),
          ),
        ),
        E.flatMap((envelope) =>
          pipe(
            envelope,
            E.fromPredicate(
              (env) => !this.processedMessageIds.has(env.id),
              () => true, // Already processed, ignore
            ),
          ),
        ),
        E.map((envelope) => {
          this.markAsProcessed(envelope.id);
          logger.info("Processing message", envelope.message.type)();
          this.handleMessage(envelope);
          return true;
        }),
        E.getOrElse(() => true),
      );
    };

    sendMessage: <T extends Message>(envelope: MessageEnvelope<T>) => TE.TaskEither<unknown, void> = <
      T extends Message,
    >(
      envelope: MessageEnvelope<T>,
    ) =>
      TE.tryCatch(
        async () => {
          logger.info("Sending message", envelope)();
          window.postMessage(envelope, "*");
        },
        (error) => {
          logger.error("Failed to send message", error)();
          return postMessageError(`PostMessage failed: ${error}`);
        },
      );
  };

// biome-ignore format: ack
export const WithPostMessageAdapter = <T extends ClassType>(Base: T) =>
  compose(
    Base, 
    WithMessageAdapter, 
    WithPostMessage
);

// Error constructor

export const postMessageError = (message: string): PostMessageError => ({
  type: "PostMessageError",
  message,
});
