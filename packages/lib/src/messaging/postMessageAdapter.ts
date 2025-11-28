import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../logger";
import { type ClassType, compose } from "../mixin";
import type { Message } from "./message";
import { type MessageAdapter, WithMessageAdapter } from "./messageAdapter";
import type { MessageEnvelope } from "./messageEnvelope";

const logger = createLogger("PostMessage Adapter");

const WithPostMessage = <T extends ClassType<MessageAdapter>>(Base: T) =>
  class extends Base implements MessageAdapter {
    constructor(...args: any[]) {
      super(...args);
      window.addEventListener("message", this.handlePostMessage);
    }

    handlePostMessage = (event: MessageEvent<MessageEnvelope>) => {
      if (event.data.source === event.data.target) return;
      this.handleMessage(event.data);
      return true;
    };

    sendMessage = <T extends Message>(envelope: MessageEnvelope<T>): TE.TaskEither<Error, void> =>
      TE.tryCatch(
        async () => {
          logger.log("Sending message", envelope);
          window.postMessage(envelope, "*");
        },
        (error) => {
          logger.error("Failed to send message", error);
          return new Error(`PostMessage failed: ${error}`);
        },
      );
  };

export const WithPostMessageAdapter = <T extends ClassType>(Base: T) =>
  compose(Base, WithMessageAdapter, WithPostMessage);
