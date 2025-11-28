import { createLogger } from "../misc";
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

    sendMessage = async <T extends Message>(envelope: MessageEnvelope<T>): Promise<void> => {
      logger.log("Sending message", envelope);
      window.postMessage(envelope, "*");
    };
  };

export const WithPostMessageAdapter = <T extends ClassType>(Base: T) =>
  compose(Base, WithMessageAdapter, WithPostMessage);
