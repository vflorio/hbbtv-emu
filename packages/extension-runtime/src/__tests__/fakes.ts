/**
 * In-memory fakes for the host ports, shared by the extension-runtime tests.
 * They implement the same interfaces the real browser adapters implement,
 * so services can be tested without a browser.
 */

import { DEFAULT_LOGGER_STATE, Logger } from "@hbb-emu/core";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import type {
  AdapterError,
  BaseMessage,
  ExtensionChannel,
  MessagingAdapter,
  StorageAdapter,
  TabStatus,
  TabsAdapter,
  WebRequestAdapter,
} from "../adapter";

const noop = () => IO.of(undefined);

export const silentLogger = (): Logger =>
  new Logger("test", DEFAULT_LOGGER_STATE, { debug: noop, info: noop, warn: noop, error: noop });

/**
 * Behaves like `chrome.storage.local`: values are JSON-serialized, so whatever
 * cannot survive JSON (Set, Map, Date, class instances) comes back changed.
 */
export const createFakeStorage = <T>(initial?: T) => {
  let raw: string | undefined = initial === undefined ? undefined : JSON.stringify(initial);
  let failNext: AdapterError | undefined;

  const storage: StorageAdapter<T> = {
    read: () => {
      if (failNext) {
        const error = failNext;
        failNext = undefined;
        return TE.left(error);
      }
      return TE.right(raw === undefined ? O.none : O.some(JSON.parse(raw) as T));
    },
    write: (state) => {
      if (failNext) {
        const error = failNext;
        failNext = undefined;
        return TE.left(error);
      }
      raw = JSON.stringify(state);
      return TE.right(undefined);
    },
  };

  return {
    storage,
    /** What is currently persisted, after the JSON round-trip. */
    stored: (): T | undefined => (raw === undefined ? undefined : (JSON.parse(raw) as T)),
    /** Makes the next read or write fail with the given error. */
    failNextWith: (error: AdapterError) => {
      failNext = error;
    },
  };
};

export const createFakeTabs = () => {
  const handlers = new Set<(tabId: number, status: TabStatus) => void>();
  const tabs: TabsAdapter = {
    onTabsUpdated: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
  return {
    tabs,
    emit: (tabId: number, status: TabStatus) => {
      for (const handler of handlers) handler(tabId, status);
    },
  };
};

type HeadersHandler = Parameters<WebRequestAdapter["onHeadersReceived"]>[0];

export const createFakeWebRequest = () => {
  let handler: HeadersHandler | undefined;
  const webRequest: WebRequestAdapter = {
    onHeadersReceived: (h) => {
      handler = h;
      return () => {
        handler = undefined;
      };
    },
  };
  return {
    webRequest,
    respond: (details: Partial<chrome.webRequest.OnHeadersReceivedDetails>) => {
      if (!handler) throw new Error("no onHeadersReceived handler registered");
      return handler(details as chrome.webRequest.OnHeadersReceivedDetails);
    },
  };
};

/** Lets pending promise callbacks run (for code that fires Tasks without awaiting them). */
export const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Background messaging: `receive` plays a content script, `sent` records what went to tabs. */
export const createFakeMessaging = <T extends BaseMessage>() => {
  const sent: Array<{ tabId: number; message: T }> = [];
  let handler: ((message: BaseMessage, tabId: number) => IO.IO<void>) | undefined;
  const messaging: MessagingAdapter<T> = {
    sendToTab: (tabId, message) => {
      sent.push({ tabId, message });
      return TE.right(undefined);
    },
    broadcast: () => TE.right(undefined),
    onMessage: (h) => {
      handler = h;
      return () => {
        handler = undefined;
      };
    },
  };
  return { messaging, sent, receive: (message: object, tabId: number) => handler?.(message as BaseMessage, tabId)() };
};

/** Content-script side of extension messaging. */
export const createFakeExtensionChannel = <T extends BaseMessage>() => {
  const sent: T[] = [];
  let handler: ((message: unknown) => IO.IO<void>) | undefined;
  let failNext = false;
  const channel: ExtensionChannel<T> = {
    send: (message) => {
      if (failNext) {
        failNext = false;
        return TE.left({ _tag: "MessageForwardError", tabId: 0, cause: "no receiver" });
      }
      sent.push(message);
      return TE.right(undefined);
    },
    onMessage: (h) => {
      handler = h;
      return () => {
        handler = undefined;
      };
    },
  };
  return {
    channel,
    sent,
    receive: (message: unknown) => handler?.(message)(),
    failNextSend: () => {
      failNext = true;
    },
  };
};
