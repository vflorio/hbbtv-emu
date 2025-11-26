import type { ExtensionConfig } from "./config";

export type MessageSource = "SIDE_PANEL" | "SERVICE_WORKER" | "CONTENT_SCRIPT" | "BRIDGE_SCRIPT";

export const validMessageSource: MessageSource[] = ["SIDE_PANEL", "SERVICE_WORKER", "CONTENT_SCRIPT", "BRIDGE_SCRIPT"];

export const isValidMessageSource = (source: string): source is MessageSource =>
  validMessageSource.includes(source as MessageSource);

export type Message =
  | { type: "UPDATE_USER_AGENT"; payload: string }
  | { type: "UPDATE_CHANNELS"; payload: ExtensionConfig.Channel[] }
  | { type: "UPDATE_VERSION"; payload: string }
  | { type: "UPDATE_COUNTRY_CODE"; payload: string }
  | { type: "UPDATE_CAPABILITIES"; payload: string };

export const validMessageType: Message["type"][] = [
  "UPDATE_USER_AGENT",
  "UPDATE_CHANNELS",
  "UPDATE_VERSION",
  "UPDATE_COUNTRY_CODE",
  "UPDATE_CAPABILITIES",
];

export const isValidMessageType = (type: string): type is Message["type"] =>
  validMessageType.includes(type as Message["type"]);

export interface MessageEnvelope<T extends Message = Message> {
  id: string;
  timestamp: number;
  message: T;
  source: MessageSource;
  tabId?: number;
}

export type MessageHandler<T extends Message = Message> = (envelope: MessageEnvelope<T>) => Promise<void> | void;

export interface MessageAdapter {
  shouldHandleMessage(envelope: MessageEnvelope): boolean;
  enrichEnvelope(envelope: MessageEnvelope, sender: chrome.runtime.MessageSender): void;
  registerMessageHandler(handler: MessageHandler): void;
  sendMessage<T extends Message>(envelope: MessageEnvelope<T>): Promise<void>;
  sendToTab<T extends Message>(tabId: number, envelope: MessageEnvelope<T>): Promise<void>;
}

export const isMessage = (data: unknown): data is Message =>
  typeof data === "object" &&
  data !== null &&
  "type" in data &&
  "payload" in data &&
  isValidMessageType((data as { type: string }).type);

export const isMessageEnvelope = (data: unknown): data is MessageEnvelope => {
  if (typeof data !== "object" || data === null) return false;
  if (!("id" in data && "timestamp" in data && "message" in data && "source" in data)) return false;

  const envelope = data as MessageEnvelope;
  return (
    typeof envelope.id === "string" &&
    typeof envelope.timestamp === "number" &&
    isValidMessageSource(envelope.source as string) &&
    isMessage(envelope.message)
  );
};

export const bridgeProxyPrefix = "HBBTV_EMU_";
