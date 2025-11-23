export type MessageType = "UI_TO_CONTENT" | "CONTENT_TO_UI" | "SERVICE_TO_UI" | "CONTENT_TO_SERVICE";

export type Message =
  // side-panel -> service-worker -> content-script
  | { type: "UI_TO_CONTENT"; action: "TUNE_CHANNEL"; payload: { channelId: string } }
  | { type: "UI_TO_CONTENT"; action: "DISPATCH_STREAM_EVENT"; payload: StreamEventPayload }
  | { type: "UI_TO_CONTENT"; action: "SET_PLAY_STATE"; payload: { state: number } }
  | { type: "UI_TO_CONTENT"; action: "GET_CURRENT_STATE" }

  // content-script -> service-worker -> side-panel
  | { type: "CONTENT_TO_UI"; action: "STATE_UPDATE"; payload: HbbTvState }
  | { type: "CONTENT_TO_UI"; action: "CHANNEL_CHANGED"; payload: { channelId: string } }
  | { type: "CONTENT_TO_UI"; action: "STREAM_EVENT_TRIGGERED"; payload: StreamEventPayload }

  // service-worker -> side-panel (internal)
  | { type: "SERVICE_TO_UI"; action: "TAB_UPDATED"; payload: { tabId: number; url: string } }
  | { type: "SERVICE_TO_UI"; action: "HBBTV_DETECTED"; payload: { tabId: number } }

  // content-script -> service-worker (internal)
  | { type: "CONTENT_TO_SERVICE"; action: "READY"; payload: { tabId: number } }
  | { type: "CONTENT_TO_SERVICE"; action: "ERROR"; payload: { error: string } };

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

export type MessageSource = "UI" | "SERVICE" | "CONTENT" | "";

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
