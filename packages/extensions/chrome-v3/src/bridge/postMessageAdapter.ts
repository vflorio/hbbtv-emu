import type { ClassType } from "@hbb-emu/core";
import { createLogger } from "@hbb-emu/core";
import { isMessageEnvelope, type MessageEnvelope } from "@hbb-emu/core/message-bus";
import * as TE from "fp-ts/TaskEither";

const logger = createLogger("Bridge:PostMessageAdapter");

export type ForwardToBackgroundError = Readonly<{
  type: "ForwardToBackgroundError";
  message: string;
}>;

export const forwardToBackgroundError = (message: string): ForwardToBackgroundError => ({
  type: "ForwardToBackgroundError",
  message,
});

export interface PostMessageAdapter {
  forwardToBackground: (envelope: MessageEnvelope) => TE.TaskEither<ForwardToBackgroundError, void>;
}

// Listens for messages from Content Script (MAIN world) via postMessage
// and forwards them to Background Script via chrome.runtime

export const WithPostMessageAdapter = <T extends ClassType>(Base: T) =>
  class extends Base implements PostMessageAdapter {
    constructor(...args: any[]) {
      super(...args);

      // Listen for messages from Content Script (MAIN world) via postMessage
      window.addEventListener("message", this.handlePostMessage);
    }

    handlePostMessage = (event: MessageEvent): void => {
      if (event.source !== window) return;
      if (!isMessageEnvelope(event.data)) return;

      // Forward to background and handle result
      this.forwardToBackground(event.data as MessageEnvelope)().catch((error) => {
        logger.warn("Failed to forward message:", String(error))();
      });
    };

    forwardToBackground = (envelope: MessageEnvelope): TE.TaskEither<ForwardToBackgroundError, void> =>
      TE.tryCatch(
        () => chrome.runtime.sendMessage(envelope).then(() => undefined),
        (error): ForwardToBackgroundError =>
          forwardToBackgroundError(error instanceof Error ? error.message : String(error)),
      );
  };
