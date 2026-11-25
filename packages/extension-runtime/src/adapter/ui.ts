import { pipe } from "fp-ts/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import type { AdapterError, UnsubscribeFn } from "..";
import { type AdapterConfig, MANIFEST_VERSION_2, MANIFEST_VERSION_3 } from "./adapter";
import { isFromExtensionPage } from "./messaging";

/**
 * Background side of the extension pages (settings UI): request/response, plus
 * notifications to every open UI. Messages from content scripts are left to `MessagingAdapter`.
 */
export interface UiAdapter {
  readonly onRequest: <Req, Res>(
    isRequest: (message: unknown) => message is Req,
    handler: (request: Req) => T.Task<Res>,
  ) => UnsubscribeFn;
  /** Succeeds even when no UI is open. */
  readonly notify: (message: unknown) => T.Task<void>;
}

/**
 * @since Chrome 26+ Firefox 45+
 */
export const createUiAdapter = ({ manifest }: AdapterConfig): UiAdapter => ({
  onRequest: (isRequest, handler) => {
    const listener = (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ): boolean => {
      if (!isFromExtensionPage(sender) || !isRequest(message)) return false;
      void handler(message)().then(sendResponse);
      return true; // the response is sent asynchronously
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  },

  notify: (message) =>
    pipe(
      TE.tryCatch(
        () =>
          match(manifest)
            .with(
              MANIFEST_VERSION_2,
              () => new Promise<void>((resolve) => chrome.runtime.sendMessage(message, () => resolve())),
            )
            .with(MANIFEST_VERSION_3, () => chrome.runtime.sendMessage(message).then(() => undefined))
            .exhaustive(),
        (cause): AdapterError => ({ _tag: "MessageForwardError", tabId: 0, cause }),
      ),
      // A rejection only means that no UI is open.
      T.map(() => undefined),
    ),
});
