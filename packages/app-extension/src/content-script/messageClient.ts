import { MessageClient, type Message, type MessageEnvelope, type MessageResponse } from "@hbb-emu/message-bus";

export class InjectMessageClient extends MessageClient {
  constructor() {
    super("INJECT");
  }

  shouldHandleMessage = (envelope: MessageEnvelope): boolean => envelope.message.type === "UI_TO_INJECT";

  onUIMessage = <T extends Extract<Message, { type: "UI_TO_INJECT" }>>(
    action: T["action"],
    handler: (payload: unknown, envelope: MessageEnvelope<T>) => void | Promise<void>,
  ) => {
    this.bus.on("UI_TO_INJECT", (message, envelope) => {
      if (message.action !== action) return;
      const payload = "payload" in message ? message.payload : undefined;
      handler(payload, envelope as MessageEnvelope<T>);
    });
  };

  sendToUI = async <T extends Extract<Message, { type: "INJECT_TO_UI" }>>(message: T): Promise<MessageResponse> =>
    this.sendMessage(this.bus.createEnvelope(message));

  sendToBackground = async <T extends Extract<Message, { type: "INJECT_TO_BACKGROUND" }>>(
    message: T,
  ): Promise<MessageResponse> => this.sendMessage(this.bus.createEnvelope(message));

  notifyReady = async (tabId: number): Promise<MessageResponse> =>
    this.sendToBackground({
      type: "INJECT_TO_BACKGROUND",
      action: "READY",
      payload: { tabId },
    });

  reportError = async (error: string): Promise<MessageResponse> =>
    this.sendToBackground({
      type: "INJECT_TO_BACKGROUND",
      action: "ERROR",
      payload: { error },
    });

  notifyStateUpdate = async (
    playState: number,
    currentChannel: {
      name: string;
      idType: number;
      onid?: number;
      tsid?: number;
      sid?: number;
    } | null,
    volume: number,
    fullScreen: boolean,
  ): Promise<MessageResponse> =>
    this.sendToUI({
      type: "INJECT_TO_UI",
      action: "STATE_UPDATE",
      payload: { playState, currentChannel, volume, fullScreen },
    });

  notifyChannelChanged = async (channelId: string): Promise<MessageResponse> =>
    this.sendToUI({
      type: "INJECT_TO_UI",
      action: "CHANNEL_CHANGED",
      payload: { channelId },
    });

  notifyStreamEventTriggered = async (
    targetURL: string,
    eventName: string,
    data: string,
    text?: string,
    version?: number,
  ): Promise<MessageResponse> =>
    this.sendToUI({
      type: "INJECT_TO_UI",
      action: "STREAM_EVENT_TRIGGERED",
      payload: { targetURL, eventName, data, text, version },
    });
}
