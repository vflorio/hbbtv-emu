import type { Message, MessageEnvelope } from "../message";
import { createLogger } from "../misc";
import type { ClassType } from "../mixin";

const logger = createLogger("Chrome Message Sender");

export interface ChromeMessageSender {
  sendMessage<T extends Message>(envelope: MessageEnvelope<T>): Promise<void>;
  sendToTab<T extends Message>(tabId: number, envelope: MessageEnvelope<T>): Promise<void>;
}

export const WithChromeMessageSender = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeMessageSender {
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
