import { createLogger } from "../misc";
import type { ClassType } from "../mixin";
import { isValidMessageEnvelope, type Message, type MessageEnvelope, type MessageOrigin } from "./message";

export interface MessageAdapter {
  registerMessageBus: RegisterMessageBus;
  sendMessage<T extends Message>(envelope: MessageEnvelope<T>): Promise<void>;
  handleMessage(data: unknown): boolean;
  tabId?: number; // Only for Content Script and Bridge Script
}

export type RegisterMessageBus = (origin: MessageOrigin, handler: MessageHandler) => void;

export type MessageHandler<T extends Message = Message> = (envelope: MessageEnvelope<T>) => Promise<void> | void;

const logger = createLogger("Message Adapter");

export const WithMessageAdapter = <T extends ClassType>(Base: T) =>
  class extends Base implements MessageAdapter {
    messageOrigin: MessageOrigin | null = null;
    messageHandler: MessageHandler | null = null;

    registerMessageBus = (origin: MessageOrigin, handler: MessageHandler) => {
      this.messageOrigin = origin;
      this.messageHandler = handler;
    };

    handleMessage = (data: unknown) => {
      if (!isValidMessageEnvelope(data)) {
        logger.error("Invalid message format", data);
        return false;
      }

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
