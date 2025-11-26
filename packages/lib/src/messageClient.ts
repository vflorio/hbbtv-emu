import { WithChromeMessageListener } from "./chrome/ChromeMessageListener";
import { WithChromeMessageSender } from "./chrome/ChromeMessageSender";
import type { Message, MessageEnvelope, MessageSource } from "./message";
import { compose } from "./mixin";

type MessageHandler<T extends Message = Message> = (message: T, envelope: MessageEnvelope<T>) => Promise<void> | void;

export class MessageClientBase {
  private handlers: Map<string, MessageHandler[]> = new Map();
  readonly source: MessageSource;

  constructor(source: MessageSource) {
    this.source = source;
  }

  on = <T extends Message["type"]>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>) => {
    const handlers = this.handlers.get(type) || [];
    handlers.push(handler as MessageHandler);
    this.handlers.set(type, handlers);
  };

  off = <T extends Message["type"]>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>) => {
    const handlers = this.handlers.get(type);
    if (!handlers) return;
    this.handlers.set(
      type,
      handlers.filter((h) => h !== handler),
    );
  };

  dispatch = async (envelope: MessageEnvelope): Promise<void> => {
    const handlers = this.handlers.get(envelope.message.type);
    if (!handlers || handlers.length === 0) {
      console.warn(`No handler for message type: ${envelope.message.type}`);
      return;
    }

    await Promise.all(handlers.map((handler) => handler(envelope.message, envelope)));
  };

  createEnvelope = <T extends Message>(message: T, tabId?: number): MessageEnvelope<T> => ({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    message,
    source: this.source,
    tabId,
  });
}

export const MessageClient = compose(MessageClientBase, WithChromeMessageListener, WithChromeMessageSender);
export type MessageClient = InstanceType<typeof MessageClient>;

export interface MessageBus {
  bus: MessageClient;
}

export const WithMessageBus =
  (source: MessageSource) =>
  <T extends {}>(Base: T) =>
    class extends (Base as any) implements MessageBus {
      bus: MessageClient;

      constructor(...args: any[]) {
        super(...args);
        this.bus = new MessageClient(source);
      }
    };
