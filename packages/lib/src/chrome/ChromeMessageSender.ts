import type { Message, MessageEnvelope } from "../message";
import type { ClassType } from "../mixin";

export interface ChromeMessageSender {
  sendMessage<T extends Message>(envelope: MessageEnvelope<T>): Promise<void>;
  sendToTab<T extends Message>(tabId: number, envelope: MessageEnvelope<T>): Promise<void>;
}

export const WithChromeMessageSender = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeMessageSender {
    sendMessage = async <T extends Message>(envelope: MessageEnvelope<T>): Promise<void> => {
      try {
        await chrome.runtime.sendMessage(envelope);
      } catch (error) {
        console.error("Failed to send message:", error);
        throw error;
      }
    };

    sendToTab = async <T extends Message>(tabId: number, envelope: MessageEnvelope<T>): Promise<void> => {
      try {
        await chrome.tabs.sendMessage(tabId, envelope);
      } catch (error) {
        console.error("Failed to send message to tab:", error);
        throw error;
      }
    };
  };
