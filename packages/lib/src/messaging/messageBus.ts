import { createLogger } from "../misc";
import type { ClassType } from "../mixin";
import type { Message, MessageEnvelope, MessageOrigin, MessageType } from "./message";
import type { MessageAdapter, MessageHandler } from "./messageAdapter";

const logger = createLogger("MessageBus");

export interface MessageBus {
  readonly messageOrigin: MessageOrigin;
  createEnvelope<T extends Message>(message: T, target?: MessageOrigin, tabId?: number): MessageEnvelope<T>;
  bus: {
    on<T extends MessageType>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>): void;
    off<T extends MessageType>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>): void;
    dispatch(envelope: MessageEnvelope): Promise<void>;
  };
}

export const WithMessageBus =
  (messageOrigin: MessageOrigin) =>
  <T extends ClassType<MessageAdapter>>(Base: T) =>
    class extends Base implements MessageBus {
      readonly messageOrigin: MessageOrigin = messageOrigin;
      handlers: Map<string, MessageHandler[]> = new Map();

      constructor(...args: any[]) {
        super(...args);
        this.registerMessageBus(messageOrigin, this.bus.dispatch);
      }

      createEnvelope = <T extends Message>(message: T, target: MessageOrigin): MessageEnvelope<T> => ({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        timestamp: Date.now(),
        message,
        source: this.messageOrigin,
        target,
      });

      bus = {
        on: <T extends MessageType>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>) => {
          const handlers = this.handlers.get(type) || [];
          handlers.push(handler as MessageHandler);
          this.handlers.set(type, handlers);
        },

        off: <T extends MessageType>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>) => {
          const handlers = this.handlers.get(type);
          if (!handlers) return;
          this.handlers.set(
            type,
            handlers.filter((h) => h !== handler),
          );
        },

        dispatch: async (envelope: MessageEnvelope): Promise<void> => {
          const handlers = this.handlers.get(envelope.message.type);
          if (!handlers || handlers.length === 0) {
            logger.warn(`No handler for message type: ${envelope.message.type}`);
            return;
          }

          logger.log(`Dispatching message of type: ${envelope.message.type} to ${handlers.length} handler(s)`);
          await Promise.all(handlers.map((handler) => handler(envelope)));
        },
      };
    };
