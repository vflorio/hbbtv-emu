import { isMessage, isValidMessageOrigin, type Message, type MessageOrigin } from "./message";

export type ServiceWorkerMessageContext = {
  tabId: number;
};

export interface MessageEnvelope<T extends Message = Message> {
  id: string;
  timestamp: number;
  message: T;
  source: MessageOrigin;
  target: MessageOrigin;
  context?: ServiceWorkerMessageContext;
}

export const isValidMessageEnvelope = (data: unknown): data is MessageEnvelope =>
  // Step 1
  typeof data === "object" &&
  data !== null &&
  // Step 2
  "id" in data &&
  "timestamp" in data &&
  "message" in data &&
  "source" in data &&
  "target" in data &&
  // Step 3
  typeof data.id === "string" &&
  typeof data.timestamp === "number" &&
  typeof data.source === "string" &&
  typeof data.target === "string" &&
  // Step 4
  isValidMessageOrigin(data.source) &&
  isValidMessageOrigin(data.target) &&
  isMessage(data.message);

export const createEnvelope = <T extends Message>(
  source: MessageOrigin,
  target: MessageOrigin,
  message: T,
  context?: ServiceWorkerMessageContext,
): MessageEnvelope<T> => ({
  id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
  timestamp: Date.now(),
  message,
  source,
  target,
  context,
});
