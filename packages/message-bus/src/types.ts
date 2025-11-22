export type MessageTyp = "UI_TO_INJECT" | "INJECT_TO_UI" | "BACKGROUND_TO_UI" | "INJECT_TO_BACKGROUND";

export type Message =
  // UI -> Background -> Inject
  | { type: "UI_TO_INJECT"; action: "TUNE_CHANNEL"; payload: { channelId: string } }
  | { type: "UI_TO_INJECT"; action: "DISPATCH_STREAM_EVENT"; payload: StreamEventPayload }
  | { type: "UI_TO_INJECT"; action: "SET_PLAY_STATE"; payload: { state: number } }
  | { type: "UI_TO_INJECT"; action: "GET_CURRENT_STATE" }

  // Inject -> Background -> UI
  | { type: "INJECT_TO_UI"; action: "STATE_UPDATE"; payload: HbbTvState }
  | { type: "INJECT_TO_UI"; action: "CHANNEL_CHANGED"; payload: { channelId: string } }
  | { type: "INJECT_TO_UI"; action: "STREAM_EVENT_TRIGGERED"; payload: StreamEventPayload }

  // Background -> UI (internal)
  | { type: "BACKGROUND_TO_UI"; action: "TAB_UPDATED"; payload: { tabId: number; url: string } }
  | { type: "BACKGROUND_TO_UI"; action: "HBBTV_DETECTED"; payload: { tabId: number } }

  // Inject -> Background (internal)
  | { type: "INJECT_TO_BACKGROUND"; action: "READY"; payload: { tabId: number } }
  | { type: "INJECT_TO_BACKGROUND"; action: "ERROR"; payload: { error: string } };

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

export type MessageSource = "UI" | "BACKGROUND" | "INJECT";

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
