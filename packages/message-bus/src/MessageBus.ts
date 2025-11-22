import type { Message, MessageEnvelope, MessageResponse, MessageSource } from "./types";

export type MessageHandler<T extends Message = Message> = (
  message: T,
  envelope: MessageEnvelope<T>,
) => Promise<MessageResponse> | MessageResponse | void;

export type MessageHandlerMap = {
  [K in Message["type"]]?: MessageHandler<Extract<Message, { type: K }>>;
};

export class MessageBus {
  private handlers: Map<string, MessageHandler[]> = new Map();
  private source: MessageSource;

  constructor(source: MessageSource) {
    this.source = source;
  }

  on = <T extends Message["type"]>(type: T, handler: MessageHandler<Extract<Message, { type: T }>>) => {
    const handlers = this.handlers.get(type) || [];
    handlers.push(handler as MessageHandler);
    this.handlers.set(type, handlers);
  };

  handleMessage = async (envelope: MessageEnvelope): Promise<MessageResponse | void> => {
    const handlers = this.handlers.get(envelope.message.type);
    if (!handlers || handlers.length === 0) {
      console.warn(`No handler for message type: ${envelope.message.type}`);
      return;
    }

    const results = await Promise.all(handlers.map((handler) => handler(envelope.message, envelope)));

    return results.find((r) => r !== undefined);
  };

  createEnvelope = <T extends Message>(message: T, tabId?: number): MessageEnvelope<T> => ({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    message,
    source: this.source,
    tabId,
  });
}
