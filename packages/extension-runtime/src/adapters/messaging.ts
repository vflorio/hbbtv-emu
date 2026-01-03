import type { BackgroundServiceError } from "@hbb-emu/extension-runtime";
import type * as IO from "fp-ts/IO";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import type { ManifestVersion, UnsubscribeFn } from ".";

export type BaseMessage = { readonly _tag: string };

export interface MessagingAdapter<T extends BaseMessage> {
  readonly sendToTab: (tabId: number, message: T) => TE.TaskEither<BackgroundServiceError, void>;
  readonly broadcast: (message: T) => TE.TaskEither<BackgroundServiceError, void>;
  readonly onMessage: (handler: (message: BaseMessage, tabId: number) => IO.IO<void>) => UnsubscribeFn;
}

/**
 * @since Chrome 41+ Firefox 45+
 */
export const createMessagingAdapter = <T extends BaseMessage>(
  manifestVersion: ManifestVersion,
): MessagingAdapter<T> => ({
  sendToTab: (tabId: number, message: T) =>
    TE.tryCatch(
      () =>
        match(manifestVersion)
          .with(
            2,
            () =>
              new Promise<void>((resolve, reject) =>
                chrome.tabs.sendMessage(tabId, message, () =>
                  chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(),
                ),
              ),
          )
          .with(3, () => chrome.tabs.sendMessage(tabId, message))
          .exhaustive(),
      (cause): BackgroundServiceError => ({
        _tag: "MessageForwardError",
        tabId,
        cause,
      }),
    ),

  broadcast: (message: T) =>
    match(manifestVersion)
      .with(2, () =>
        TE.tryCatch(
          () =>
            new Promise<void>((resolve) => {
              chrome.runtime.sendMessage(message, () => resolve());
            }),
          (cause): BackgroundServiceError => ({
            _tag: "MessageForwardError",
            tabId: 0,
            cause,
          }),
        ),
      )
      .with(3, () =>
        TE.tryCatch(
          () => chrome.runtime.sendMessage(message),
          (cause): BackgroundServiceError => ({
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
