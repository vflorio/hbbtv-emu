import {
  isMessageEnvelope,
  type Message,
  type MessageAdapter,
  type MessageEnvelope,
  type MessageHandler,
} from "../message";
import { createLogger } from "../misc";
import type { ClassType } from "../mixin";

const logger = createLogger("Chrome Message Listener");

export const WithChromeMessageAdapter = <T extends ClassType>(Base: T) =>
  class extends Base implements MessageAdapter {
    messageHandler: MessageHandler | null = null;

    constructor(...args: any[]) {
      super(...args);
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
      data: MessageEnvelope,
      sender: chrome.runtime.MessageSender,
      // TODO   sendResponse: (response?: unknown) => void,
    ) => {
      if (!isMessageEnvelope(data)) {
        logger.error("Invalid message format");
        return false;
      }

      if (!this.shouldHandleMessage(data)) return false;

      this.enrichEnvelope(data, sender);

      if (!this.messageHandler) {
        logger.error("No message handler registered");
        return false;
      }

      this.messageHandler(data);

      return true;
    };

    sendMessage = async <T extends Message>(envelope: MessageEnvelope<T>): Promise<void> => {
      if (typeof chrome === "undefined" || !chrome.runtime) {
        logger.warn("Chrome runtime not available, message not sent");
        return;
      }

      try {
        await chrome.runtime.sendMessage(envelope);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Receiving end does not exist")) {
          logger.debug("No message listeners registered yet");
          return;
        }
        logger.error("Failed to send message:", error);
        throw error;
      }
    };

    sendToTab = async <T extends Message>(tabId: number, envelope: MessageEnvelope<T>): Promise<void> => {
      if (typeof chrome === "undefined" || !chrome.tabs) {
        logger.warn("Chrome tabs not available, message not sent");
        return;
      }

      try {
        await chrome.tabs.sendMessage(tabId, envelope);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Receiving end does not exist")) {
          logger.debug("No message listeners registered in tab");
          return;
        }
        logger.error("Failed to send message to tab:", error);
        throw error;
      }
    };
  };
