import { isMessageEnvelope, type MessageEnvelope } from "../message";
import type { ClassType } from "../mixin";

export type MessageHandler = (envelope: MessageEnvelope) => Promise<void>;

export interface ChromeMessageListener {
  shouldHandleMessage(envelope: MessageEnvelope): boolean;
  enrichEnvelope(envelope: MessageEnvelope, sender: chrome.runtime.MessageSender): void;
  registerMessageHandler(handler: MessageHandler): void;
}

export const WithChromeMessageListener = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeMessageListener {
    messageHandler: MessageHandler | null = null;

    constructor(...args: any[]) {
      super(...args);
      // Registra il listener solo se chrome.runtime è disponibile
      if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener(this.handleChromeMessage);
      }
    }

    shouldHandleMessage = (_envelope: MessageEnvelope): boolean => true; // Override in base class if needed

    enrichEnvelope = (_envelope: MessageEnvelope, _sender: chrome.runtime.MessageSender) => {
      // Override in base class if needed
    };

    registerMessageHandler = (handler: MessageHandler) => {
      this.messageHandler = handler;
    };

    handleChromeMessage = (
      data: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => {
      if (!isMessageEnvelope(data)) {
        console.error("Invalid message format");
        return false;
      }

      if (!this.shouldHandleMessage(data)) return false;

      this.enrichEnvelope(data, sender);

      if (!this.messageHandler) {
        console.error("No message handler registered");
        return false;
      }

      this.messageHandler(data)
        .then(() => {
          sendResponse();
        })
        .catch((error) => {
          console.error("Message handler error:", error);
          sendResponse();
        });

      return true;
    };
  };
