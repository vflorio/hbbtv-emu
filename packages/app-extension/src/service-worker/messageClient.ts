import { MessageClient, type Message, type MessageEnvelope, type MessageResponse } from "@hbb-emu/message-bus";

export class BackgroundMessageClient extends MessageClient {
  private activeTab: number | null = null;

  constructor() {
    super("BACKGROUND");
    this.registerHandlers();
  }

  shouldHandleMessage = (_envelope: MessageEnvelope): boolean => true;

  enrichEnvelope = (envelope: MessageEnvelope, sender: chrome.runtime.MessageSender): void => {
    if (sender.tab?.id) {
      envelope.tabId = sender.tab.id;
    }
  };

  setActiveTab = (tabId: number) => {
    this.activeTab = tabId;
  };

  getActiveTab = (): number | null => this.activeTab;

  private registerHandlers = () => {
    this.bus.on("UI_TO_INJECT", async (_message, envelope) => {
      if (!this.activeTab) return { success: false, error: "No active HbbTV tab" };
      return this.sendToTab(this.activeTab, envelope);
    });

    this.bus.on("INJECT_TO_UI", async (_message, envelope) => this.sendToUI(envelope));

    this.bus.on("INJECT_TO_BACKGROUND", async (message) => {
      if (message.action === "READY") {
        console.log("Inject script ready in tab:", message.payload.tabId);
        this.setActiveTab(message.payload.tabId);

        await this.sendToUI(
          this.bus.createEnvelope({
            type: "BACKGROUND_TO_UI",
            action: "HBBTV_DETECTED",
            payload: { tabId: message.payload.tabId },
          }),
        );
      } else if (message.action === "ERROR") {
        console.error("Inject script error:", message.payload.error);
      }

      return { success: true };
    });
  };

  private sendToUI = async (envelope: MessageEnvelope): Promise<MessageResponse> => {
    try {
      const response = await chrome.runtime.sendMessage(envelope);
      return response as MessageResponse;
    } catch (error) {
      console.debug("Failed to send to UI:", error);
      return { success: false, error: "UI not available" };
    }
  };

  broadcastToUI = <T extends Message>(message: T) => {
    const envelope = this.bus.createEnvelope(message);
    this.sendToUI(envelope).catch((error) => {
      console.error("Failed to broadcast to UI:", error);
    });
  };
}
