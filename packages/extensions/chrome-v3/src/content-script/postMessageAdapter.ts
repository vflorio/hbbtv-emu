import type { ClassType } from "@hbb-emu/core";
import { isMessageEnvelope, type MessageEnvelope } from "@hbb-emu/core/message-bus";

export interface PostMessageAdapter {
  handleIncomingMessage: (envelope: MessageEnvelope) => void;
  sendViaPostMessage: (envelope: MessageEnvelope) => void;
}

// Handles communication with Bridge via window.postMessage

export const WithPostMessageAdapter = <T extends ClassType>(Base: T) =>
  class extends Base implements PostMessageAdapter {
    constructor(...args: any[]) {
      super(...args);

      window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        if (!isMessageEnvelope(event.data)) return;
        if (event.data.target !== "CONTENT_SCRIPT") return;

        this.handleIncomingMessage(event.data);
      });
    }

    // overridden in PostMessageClient
    handleIncomingMessage = (_envelope: MessageEnvelope): void => {
      // No-op
    };

    sendViaPostMessage = (envelope: MessageEnvelope): void => {
      window.postMessage(envelope, "*");
    };
  };
