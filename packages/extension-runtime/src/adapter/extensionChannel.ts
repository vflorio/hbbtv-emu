import type * as IO from "fp-ts/IO";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import type { AdapterError, UnsubscribeFn } from "..";
import { type AdapterConfig, MANIFEST_VERSION_2, MANIFEST_VERSION_3 } from "./adapter";
import type { BaseMessage } from "./messaging";

/**
 * Messaging from a content script to the rest of the extension (the background),
 * and from the extension back to it. The background side is `MessagingAdapter`.
 */
export interface ExtensionChannel<Out extends BaseMessage> {
  readonly send: (message: Out) => TE.TaskEither<AdapterError, void>;
  /** Only messages sent by the extension itself (not by other tabs). */
  readonly onMessage: (handler: (message: unknown) => IO.IO<void>) => UnsubscribeFn;
}

/**
 * @since Chrome 26+ Firefox 45+
 */
export const createExtensionChannel = <Out extends BaseMessage>({
  manifest,
}: AdapterConfig): ExtensionChannel<Out> => ({
  send: (message) =>
    TE.tryCatch(
      () =>
        match(manifest)
          .with(
            MANIFEST_VERSION_2,
            () =>
              new Promise<void>((resolve, reject) =>
                chrome.runtime.sendMessage(message, () =>
                  chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(),
                ),
              ),
          )
          .with(MANIFEST_VERSION_3, () => chrome.runtime.sendMessage(message).then(() => undefined))
          .exhaustive(),
      (cause): AdapterError => ({ _tag: "MessageForwardError", tabId: 0, cause }),
    ),

  onMessage: (handler) => {
    const listener = (message: unknown, sender: chrome.runtime.MessageSender) => {
      if (sender.tab) return;
      handler(message)();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  },
});
