import type { Message, MessageEnvelope } from "../message";
import type { ClassType } from "../mixin";

export interface ChromeMessageSender {
  sendMessage<T extends Message>(envelope: MessageEnvelope<T>): Promise<void>;
  sendToTab<T extends Message>(tabId: number, envelope: MessageEnvelope<T>): Promise<void>;
}

export const WithChromeMessageSender = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeMessageSender {
    sendMessage = async <T extends Message>(envelope: MessageEnvelope<T>): Promise<void> => {
      // Verifica che chrome.runtime sia disponibile
      if (typeof chrome === "undefined" || !chrome.runtime) {
        console.warn("Chrome runtime not available, message not sent");
        return;
      }
      
      try {
        await chrome.runtime.sendMessage(envelope);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Receiving end does not exist")) {
          console.debug("No message listeners registered yet");
          return;
        }
        console.error("Failed to send message:", error);
        throw error;
      }
    };

    sendToTab = async <T extends Message>(tabId: number, envelope: MessageEnvelope<T>): Promise<void> => {
      // Verifica che chrome.tabs sia disponibile
      if (typeof chrome === "undefined" || !chrome.tabs) {
        console.warn("Chrome tabs not available, message not sent");
        return;
      }
      
      try {
        await chrome.tabs.sendMessage(tabId, envelope);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Receiving end does not exist")) {
          console.debug("No message listeners registered in tab");
          return;
        }
        console.error("Failed to send message to tab:", error);
        throw error;
      }
    };
  };
