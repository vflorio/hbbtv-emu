import type * as IO from "fp-ts/IO";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import type { AdapterError, UnsubscribeFn } from "..";
import { type AdapterConfig, MANIFEST_VERSION_2, MANIFEST_VERSION_3 } from ".";

export type BaseMessage = { readonly _tag: string };

export interface MessagingAdapter<T extends BaseMessage> {
  readonly sendToTab: (tabId: number, message: T) => TE.TaskEither<AdapterError, void>;
  readonly broadcast: (message: T) => TE.TaskEither<AdapterError, void>;
  readonly onMessage: (handler: (message: BaseMessage, tabId: number) => IO.IO<void>) => UnsubscribeFn;
}

/**s
 * @since Chrome 41+ Firefox 45+
 */
export const createMessagingAdapter = <T extends BaseMessage>({ manifest }: AdapterConfig): MessagingAdapter<T> => ({
  sendToTab: (tabId: number, message: T) =>
    TE.tryCatch(
      () =>
        match(manifest)
          .with(
            MANIFEST_VERSION_2,
            () =>
              new Promise<void>((resolve, reject) =>
                chrome.tabs.sendMessage(tabId, message, () =>
                  chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(),
                ),
              ),
          )
          .with(MANIFEST_VERSION_3, () => chrome.tabs.sendMessage(tabId, message))
          .exhaustive(),
      (cause): AdapterError => ({
        _tag: "MessageForwardError",
        tabId,
        cause,
      }),
    ),

  broadcast: (message: T) =>
    match(manifest)
      .with(MANIFEST_VERSION_2, () =>
        TE.tryCatch(
          () =>
            new Promise<void>((resolve) => {
              chrome.runtime.sendMessage(message, () => resolve());
            }),
          (cause): AdapterError => ({
            _tag: "MessageForwardError",
            tabId: 0,
            cause,
          }),
        ),
      )
      .with(MANIFEST_VERSION_3, () =>
        TE.tryCatch(
          () => chrome.runtime.sendMessage(message),
          (cause): AdapterError => ({
            _tag: "MessageForwardError",
            tabId: 0,
            cause,
          }),
        ),
      )
      .exhaustive(),

  onMessage: (handler) => {
    const listener = (message: unknown, sender: chrome.runtime.MessageSender) => {
      const tabId = sender.tab?.id;
      if (!tabId || !isBaseMessage(message)) return;
      handler(message, tabId)();
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  },
});

const isBaseMessage = (value: unknown): value is BaseMessage =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  typeof (value as { _tag: unknown })._tag === "string";
