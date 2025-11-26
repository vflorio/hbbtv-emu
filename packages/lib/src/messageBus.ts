import type { Message, MessageAdapter, MessageEnvelope, MessageHandler, MessageSource } from "./message";
import { createLogger } from "./misc";
import type { ClassType } from "./mixin";

const logger = createLogger("MessageBus");

export interface MessageBus {
  readonly source: MessageSource;
  bus: {
    on<T extends Message["type"]>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>): void;
    off<T extends Message["type"]>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>): void;
    dispatch(envelope: MessageEnvelope): Promise<void>;
    createEnvelope<T extends Message>(message: T, tabId?: number): MessageEnvelope<T>;
  };
}

export const WithMessageBus =
  (source: MessageSource) =>
  <T extends ClassType<MessageAdapter>>(Base: T) =>
    class extends Base implements MessageBus {
      readonly source: MessageSource = source;
      handlers: Map<string, MessageHandler[]> = new Map();

      constructor(...args: any[]) {
        super(...args);
        this.registerMessageHandler(this.bus.dispatch);
      }

      bus = {
        on: <T extends Message["type"]>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>) => {
          const handlers = this.handlers.get(type) || [];
          handlers.push(handler as MessageHandler);
          this.handlers.set(type, handlers);
        },

        off: <T extends Message["type"]>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>) => {
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

          await Promise.all(handlers.map((handler) => handler(envelope)));
        },

        createEnvelope: <T extends Message>(message: T, tabId?: number): MessageEnvelope<T> => ({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          message,
          source: this.source,
          tabId,
        }),
      };
    };
