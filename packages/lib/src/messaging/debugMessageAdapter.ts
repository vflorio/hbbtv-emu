import { createLogger } from "../misc";
import { type ClassType, compose } from "../mixin";
import type { Message } from "./message";
import { type MessageAdapter, WithMessageAdapter } from "./messageAdapter";
import type { MessageEnvelope } from "./messageEnvelope";

const logger = createLogger("Debug Message Adapter");

const WithDebugMessage = <T extends ClassType<MessageAdapter>>(Base: T) =>
  class extends Base implements MessageAdapter {
    sendMessage = async <T extends Message>(envelope: MessageEnvelope<T>): Promise<void> => {
      logger.log("sendMessage", envelope);
    };
  };

export const WithDebugMessageAdapter = <T extends ClassType>(Base: T) =>
  compose(Base, WithMessageAdapter, WithDebugMessage);
