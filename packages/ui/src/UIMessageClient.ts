import { MessageClient, type Message, type MessageEnvelope, type MessageResponse } from "@hbb-emu/message-bus";

export class UIMessageClient extends MessageClient {
  constructor() {
    super("UI");
  }

  shouldHandleMessage = (envelope: MessageEnvelope): boolean =>
    envelope.message.type === "INJECT_TO_UI" || envelope.message.type === "BACKGROUND_TO_UI";

  onInjectMessage = <T extends Extract<Message, { type: "INJECT_TO_UI" }>>(
    action: T["action"],
    handler: (payload: unknown, envelope: MessageEnvelope<T>) => void,
  ) => {
    this.bus.on("INJECT_TO_UI", (message, envelope) => {
      if (message.action !== action) return;
      handler(message.payload, envelope as MessageEnvelope<T>);
    });
  };

  onBackgroundMessage = <T extends Extract<Message, { type: "BACKGROUND_TO_UI" }>>(
    action: T["action"],
    handler: (payload: unknown, envelope: MessageEnvelope<T>) => void,
  ) => {
    this.bus.on("BACKGROUND_TO_UI", (message, envelope) => {
      if (message.action !== action) return;
      handler(message.payload, envelope as MessageEnvelope<T>);
    });
  };

  sendToInject = async <T extends Extract<Message, { type: "UI_TO_INJECT" }>>(message: T): Promise<MessageResponse> =>
    this.sendMessage(this.bus.createEnvelope(message));

  tuneChannel = async (channelId: string): Promise<MessageResponse> =>
    this.sendToInject({
      type: "UI_TO_INJECT",
      action: "TUNE_CHANNEL",
      payload: { channelId },
    });

  dispatchStreamEvent = async (
    targetURL: string,
    eventName: string,
    data: string,
    text?: string,
    version?: number,
  ): Promise<MessageResponse> =>
    this.sendToInject({
      type: "UI_TO_INJECT",
      action: "DISPATCH_STREAM_EVENT",
      payload: { targetURL, eventName, data, text, version },
    });

  setPlayState = async (state: number): Promise<MessageResponse> =>
    this.sendToInject({
      type: "UI_TO_INJECT",
      action: "SET_PLAY_STATE",
      payload: { state },
    });

  getCurrentState = async (): Promise<MessageResponse> =>
    this.sendToInject({
      type: "UI_TO_INJECT",
      action: "GET_CURRENT_STATE",
    });
}
