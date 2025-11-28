import { createLogger } from "../logger";
import { type Message, type MessageAdapter, type MessageEnvelope, WithMessageAdapter } from "../messaging";
import { tryCatch } from "../misc";
import { type ClassType, compose } from "../mixin";

const logger = createLogger("Chrome Message Listener");

const hasNoListenersError = (error: Error) => error.message.includes("Receiving end does not exist");

const WithChromeMessage = <T extends ClassType<MessageAdapter>>(Base: T) =>
  class extends Base implements MessageAdapter {
    constructor(...args: any[]) {
      super(...args);
      chrome.runtime.onMessage.addListener(this.handleChromeMessage);
    }

    handleChromeMessage = async (data: MessageEnvelope, sender: chrome.runtime.MessageSender) => {
      logger.log("Received message", data, sender);
      this.handleMessage(data);
    };

    sendMessage = async <T extends Message>(envelope: MessageEnvelope<T>) => {
      logger.log("Sending message", envelope);

      const handlers: Record<string, (envelope: MessageEnvelope<T>) => Promise<void>> = {
        SERVICE_WORKER: async (envelope) => {
          await this.sendMessageToServiceWorker(envelope);
        },
        CONTENT_SCRIPT: async (envelope) => {
          if (!envelope.context?.tabId) {
            logger.error("Cannot send message to content script: tabId is missing in context");
            return;
          }
          await this.sendMessageToTab(envelope, envelope.context.tabId);
        },
      };

      const handler = handlers[envelope.target];
      if (!handler) {
        logger.error("Cannot send message: no valid target specified");
        return;
      }
      await handler(envelope);
    };

    sendMessageToServiceWorker = async <T extends Message>(envelope: MessageEnvelope<T>) =>
      tryCatch(
        () => chrome.runtime.sendMessage(envelope),
        [hasNoListenersError, "No message listeners registered in service worker"],
        logger,
      );

    sendMessageToTab = async <T extends Message>(envelope: MessageEnvelope<T>, tabId: number) =>
      tryCatch(
        () => chrome.tabs.sendMessage(tabId, envelope),
        [hasNoListenersError, `No message listeners registered in tab ${tabId}`],
        logger,
      );
  };

export const WithChromeMessageAdapter = <T extends ClassType>(Base: T) =>
  compose(Base, WithMessageAdapter, WithChromeMessage);
