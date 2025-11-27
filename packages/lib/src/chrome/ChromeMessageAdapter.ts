import type { Message, MessageAdapter, MessageEnvelope } from "../messaging/message";
import { WithMessageAdapter } from "../messaging/messageAdapter";
import { createLogger, tryCatch } from "../misc";
import { type ClassType, compose } from "../mixin";

const logger = createLogger("Chrome Message Listener");

const hasNoListenersError = (error: Error) => error.message.includes("Receiving end does not exist");

const WithChromeMessage = <T extends ClassType<MessageAdapter>>(Base: T) =>
  class extends Base implements MessageAdapter {
    tabId: number | undefined;

    constructor(...args: any[]) {
      super(...args);
      chrome.runtime.onMessage.addListener(this.handleChromeMessage);
    }

    handleChromeMessage = async (data: MessageEnvelope, sender: chrome.runtime.MessageSender) => {
      if (sender.tab?.id !== undefined) {
        this.tabId = sender.tab.id;
      }
      
      this.handleMessage(data);
    };

    sendMessage = async <T extends Message>(envelope: MessageEnvelope<T>) => {
      if (this.tabId) await this.sendMessageToTab(envelope, this.tabId);
      else if (envelope.target === "SERVICE_WORKER") await this.sendMessageToServiceWorker(envelope);
      else logger.error("Cannot send message: no valid target specified");
    };

    sendMessageToServiceWorker = async <T extends Message>(envelope: MessageEnvelope<T>) =>
      tryCatch(
        async () => {
          logger.log("Sending message to service worker", envelope);
          await chrome.runtime.sendMessage(envelope);
        },
        [hasNoListenersError, "No message listeners registered in service worker"],
        logger,
      );

    sendMessageToTab = async <T extends Message>(envelope: MessageEnvelope<T>, tabId: number) =>
      tryCatch(
        async () => {
          logger.log(`Sending message to tab ${tabId}`, envelope);
          await chrome.tabs.sendMessage(tabId, envelope);
        },
        [hasNoListenersError, `No message listeners registered in tab ${tabId}`],
        logger,
      );
  };

export const WithChromeMessageAdapter = <T extends ClassType>(Base: T) =>
  compose(Base, WithMessageAdapter, WithChromeMessage);
