import { MessageBus } from "./MessageBus";
import type { Message, MessageEnvelope, MessageResponse, MessageSource } from "./types";
import { compose, type ClassType } from "@hbb-emu/lib";

export interface WithMessageBus {
  bus: MessageBus;
}

export interface ChromeMessageListener {
  shouldHandleMessage(envelope: MessageEnvelope): boolean;
  enrichEnvelope(envelope: MessageEnvelope, sender: chrome.runtime.MessageSender): void;
}

export const WithChromeListener = <T extends ClassType<WithMessageBus>>(Base: T) =>
  class extends Base implements ChromeMessageListener {
    constructor(...args: any[]) {
      super(...args);
      chrome.runtime.onMessage.addListener(this.handleChromeMessage);
    }

    shouldHandleMessage = (_envelope: MessageEnvelope): boolean => true; // Override in base class if needed

    enrichEnvelope = (_envelope: MessageEnvelope, _sender: chrome.runtime.MessageSender): void => {
      // Override in base class if needed
    };

    handleChromeMessage = (
      data: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: MessageResponse) => void,
    ) => {
      if (!this.bus.validateMessageEnvelope(data)) {
        sendResponse({ success: false, error: "Invalid message format" });
        return false;
      }

      if (!this.shouldHandleMessage(data)) {
        return false;
      }

      this.enrichEnvelope(data, sender);

      this.bus
        .handleMessage(data)
        .then((response) => {
          sendResponse(response ?? { success: true });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      return true;
    };
  };

export interface MessageSender {
  sendMessage<T extends Message>(envelope: MessageEnvelope<T>): Promise<MessageResponse>;
  sendToTab<T extends Message>(tabId: number, envelope: MessageEnvelope<T>): Promise<MessageResponse>;
  handleSendError(error: unknown): MessageResponse;
}

export const WithMessageSending = <T extends ClassType<WithMessageBus>>(Base: T) =>
  class extends Base implements MessageSender {
    sendMessage = async <T extends Message>(envelope: MessageEnvelope<T>): Promise<MessageResponse> => {
      try {
        const response = await chrome.runtime.sendMessage(envelope);
        return response as MessageResponse;
      } catch (error) {
        return this.handleSendError(error);
      }
    };

    sendToTab = async <T extends Message>(tabId: number, envelope: MessageEnvelope<T>): Promise<MessageResponse> => {
      try {
        const response = await chrome.tabs.sendMessage(tabId, envelope);
        return response as MessageResponse;
      } catch (error) {
        return this.handleSendError(error);
      }
    };

    handleSendError = (error: unknown): MessageResponse => ({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  };

export class MessageClientBase implements WithMessageBus {
  bus: MessageBus;

  constructor(context: MessageSource) {
    this.bus = new MessageBus(context);
  }
}

export const MessageClient = compose(MessageClientBase, WithChromeListener, WithMessageSending);
