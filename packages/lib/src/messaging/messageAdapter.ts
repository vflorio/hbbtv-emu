import { createLogger } from "../misc";
import type { ClassType } from "../mixin";
import {
  isMessageEnvelope,
  type Message,
  type MessageAdapter,
  type MessageEnvelope,
  type MessageHandler,
  type MessageOrigin,
} from "./message";

const logger = createLogger("Message Adapter");

export const WithMessageAdapter = <T extends ClassType>(Base: T) =>
  class extends Base implements MessageAdapter {
    messageOrigin: MessageOrigin | null = null;
    messageHandler: MessageHandler | null = null;
    shouldHandleMessage: (envelope: MessageEnvelope) => boolean = () => true;

    registerMessageBus = (
      origin: MessageOrigin,
      handler: MessageHandler,
      shouldHandleMessage: (envelope: MessageEnvelope) => boolean,
    ) => {
      this.messageOrigin = origin;
      this.messageHandler = handler;
      this.shouldHandleMessage = shouldHandleMessage;
    };

    handleMessage = (data: unknown) => {
      if (!isMessageEnvelope(data)) {
        logger.error("Invalid message format", data);
        return false;
      }

      if (!this.shouldHandleMessage(data)) return false;

      if (!this.messageHandler) {
        logger.error("No message handler registered");
        return false;
      }

      this.messageHandler(data);

      return true;
    };

    sendMessage = async <T extends Message>(_envelope: MessageEnvelope<T>): Promise<void> => {
      throw new Error("Method not implemented.");
    };
  };
