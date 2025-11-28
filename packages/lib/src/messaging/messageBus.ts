import { createLogger } from "../logger";
import type { ClassType } from "../mixin";
import type { Message, MessageOrigin, MessageType } from "./message";
import type { MessageAdapter, MessageHandler } from "./messageAdapter";
import type { MessageEnvelope } from "./messageEnvelope";

const logger = createLogger("MessageBus");

export interface MessageBus {
  readonly messageOrigin: MessageOrigin;
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
          if (!handlers || handlers.length === 0) return;

          logger.log("Dispatching message", envelope);
          await Promise.all(handlers.map((handler) => handler(envelope)));
        },
      };
    };
