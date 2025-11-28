import type { ExtensionConfig } from "../config";

// Message Source

export type MessageOrigin = "SIDE_PANEL" | "SERVICE_WORKER" | "CONTENT_SCRIPT" | "BRIDGE_SCRIPT";

export const validMessageOrigin: MessageOrigin[] = ["SIDE_PANEL", "SERVICE_WORKER", "CONTENT_SCRIPT", "BRIDGE_SCRIPT"];

export const isValidMessageOrigin = (origin: string): origin is MessageOrigin =>
  validMessageOrigin.includes(origin as MessageOrigin);

// Message Type

export type MessageType =
  | "BRIDGE_READY"
  | "CONTENT_SCRIPT_READY"
  | "UPDATE_USER_AGENT"
  | "UPDATE_CONFIG";

export const validMessageType: MessageType[] = [
  "BRIDGE_READY",
  "CONTENT_SCRIPT_READY",
  "UPDATE_USER_AGENT",
  "UPDATE_CONFIG",
];

export const isValidMessageType = (type: string): type is Message["type"] =>
  validMessageType.includes(type as Message["type"]);

// Message

export type Message =
  | { type: "BRIDGE_READY"; payload: null }
  | { type: "CONTENT_SCRIPT_READY"; payload: null }
  | { type: "UPDATE_USER_AGENT"; payload: string }
  | { type: "UPDATE_CONFIG"; payload: ExtensionConfig.State };

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
  typeof (data as MessageEnvelope).id === "string" &&
  typeof (data as MessageEnvelope).timestamp === "number" &&
  isValidMessageOrigin((data as MessageEnvelope).source) &&
  isValidMessageOrigin((data as MessageEnvelope).target) &&
  isMessage((data as MessageEnvelope).message);
