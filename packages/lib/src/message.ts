import type { ExtensionConfig } from "./config";

export type MessageSource = "SIDE_PANEL" | "SERVICE_WORKER" | "CONTENT_SCRIPT";

export const validMessageSource: MessageSource[] = ["SIDE_PANEL", "SERVICE_WORKER", "CONTENT_SCRIPT"];

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

export const isMessage = (data: unknown): data is Message =>
  typeof data === "object" && data !== null && "type" in data && "action" in data;

export const isMessageEnvelope = (data: unknown): data is MessageEnvelope =>
  typeof data === "object" &&
  data !== null &&
  "id" in data &&
  "timestamp" in data &&
  "message" in data &&
  "source" in data &&
  isMessage((data as MessageEnvelope).message);

  
export const bridgeProxyPrefix = "HBBTV_EMU_";