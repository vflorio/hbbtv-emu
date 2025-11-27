import type { ExtensionConfig } from "../config";

export const bridgeProxyPrefix = "HBBTV_EMU_";

// Message Source

export type MessageOrigin = "SIDE_PANEL" | "SERVICE_WORKER" | "CONTENT_SCRIPT" | "BRIDGE_SCRIPT";

export const validMessageOrigin: MessageOrigin[] = ["SIDE_PANEL", "SERVICE_WORKER", "CONTENT_SCRIPT", "BRIDGE_SCRIPT"];

export const isValidMessageOrigin = (origin: string): origin is MessageOrigin =>
  validMessageOrigin.includes(origin as MessageOrigin);

// Message Type

export type MessageType =
  | "CONTENT_SCRIPT_READY"
  | "UPDATE_USER_AGENT"
  | "UPDATE_CHANNELS"
  | "UPDATE_VERSION"
  | "UPDATE_COUNTRY_CODE"
  | "UPDATE_CAPABILITIES";

export const validMessageType: MessageType[] = [
  "CONTENT_SCRIPT_READY",
  "UPDATE_USER_AGENT",
  "UPDATE_CHANNELS",
  "UPDATE_VERSION",
  "UPDATE_COUNTRY_CODE",
  "UPDATE_CAPABILITIES",
];

export const isValidMessageType = (type: string): type is Message["type"] =>
  validMessageType.includes(type as Message["type"]);

// Message

export type Message =
  | { type: "CONTENT_SCRIPT_READY"; payload: null }
  | { type: "UPDATE_USER_AGENT"; payload: string }
  | { type: "UPDATE_CHANNELS"; payload: ExtensionConfig.Channel[] }
  | { type: "UPDATE_VERSION"; payload: string }
  | { type: "UPDATE_COUNTRY_CODE"; payload: string }
  | { type: "UPDATE_CAPABILITIES"; payload: string };

export const isMessage = (data: unknown): data is Message =>
  typeof data === "object" &&
  data !== null &&
  "type" in data &&
  "payload" in data &&
  isValidMessageType((data as { type: string }).type);

// Message Envelope

export interface MessageEnvelope<T extends Message = Message> {
  id: string;
  timestamp: number;
  message: T;
  source: MessageOrigin;
  target: MessageOrigin;
}

export const isMessageEnvelope = (data: unknown): data is MessageEnvelope => {
  if (typeof data !== "object" || data === null) return false;
  if (!("id" in data && "timestamp" in data && "message" in data && "source" in data)) return false;

  const envelope = data as MessageEnvelope;
  return (
    typeof envelope.id === "string" &&
    typeof envelope.timestamp === "number" &&
    isValidMessageOrigin(envelope.source) &&
    isMessage(envelope.message) &&
    (envelope.target === undefined || isValidMessageOrigin(envelope.target))
  );
};

// Message Adapter

export interface MessageAdapter {
  registerMessageBus: RegisterMessageBus;
  sendMessage<T extends Message>(envelope: MessageEnvelope<T>): Promise<void>;
  handleMessage(data: unknown): boolean;
  tabId?: number; // Only for Content Script and Bridge Script
}

export type RegisterMessageBus = (
  origin: MessageOrigin,
  handler: MessageHandler,
  shouldHandleMessage: (envelope: MessageEnvelope) => boolean,
) => void;

export type MessageHandler<T extends Message = Message> = (envelope: MessageEnvelope<T>) => Promise<void> | void;
