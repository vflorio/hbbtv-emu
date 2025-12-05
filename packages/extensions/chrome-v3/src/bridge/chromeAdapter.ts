import type { ClassType } from "@hbb-emu/core";
import { isMessageEnvelope, type MessageEnvelope } from "@hbb-emu/core/message-bus";

export interface ChromeToPostMessageBridge {
  forwardToContentScript: (envelope: MessageEnvelope) => void;
}

// Listens for messages from Background Script via chrome.runtime
// and forwards them to Content Script (MAIN world) via postMessage

export const WithChromeToPostMessageBridge = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeToPostMessageBridge {
    constructor(...args: any[]) {
      super(...args);

      // Listen for messages from Background Script via chrome.runtime
      chrome.runtime.onMessage.addListener(this.handleChromeMessage);
    }

    handleChromeMessage = (message: unknown): void => {
      if (isMessageEnvelope(message)) {
        this.forwardToContentScript(message);
      }
    };

    forwardToContentScript = (envelope: MessageEnvelope): void => {
      window.postMessage(envelope, "*");
    };
  };
