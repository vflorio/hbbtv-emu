import type { ChannelConfig } from "@hbb-emu/lib";

export type MessageType = "UI_TO_CONTENT" | "CONTENT_TO_UI" | "SERVICE_TO_UI" | "CONTENT_TO_SERVICE";
export type MessageType1 = "INIT" | "ERROR";

export type Message =
  | {
      type: "INIT";
      payload: {
        channelConfig: ChannelConfig[];
      };
    }
  | { type: "UPDATE_CHANNELS_CONFIG"; payload: ChannelConfig[] };

export interface StreamEventPayload {
  targetURL: string;
  eventName: string;
  data: string;
  text?: string;
  version?: number;
}

export interface HbbTvState {
  playState: number;
  currentChannel: {
    // FIXME Channel | Null
    name: string;
    idType: number;
    onid?: number;
    tsid?: number;
    sid?: number;
  } | null;
  volume: number;
  fullScreen: boolean;
}

export interface MessageEnvelope<T extends Message = Message> {
  id: string;
  timestamp: number;
  message: T;
  source: MessageSource;
  tabId?: number;
}

export type MessageSource = "SIDE_PANEL" | "SERVICE_WORKER" | "CONTENT_SCRIPT" | "";

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function isMessage(data: unknown): data is Message {
  return typeof data === "object" && data !== null && "type" in data && "action" in data;
}

export function isMessageEnvelope(data: unknown): data is MessageEnvelope {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "timestamp" in data &&
    "message" in data &&
    "source" in data &&
    isMessage((data as MessageEnvelope).message)
  );
}
