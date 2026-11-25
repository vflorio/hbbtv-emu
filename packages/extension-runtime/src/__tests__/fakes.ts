/**
 * In-memory fakes for the host ports, shared by the extension-runtime tests.
 * They implement the same interfaces the real browser adapters implement,
 * so services can be tested without a browser.
 */

import { DEFAULT_LOGGER_STATE, Logger } from "@hbb-emu/core";
import * as E from "fp-ts/Either";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import type {
  AdapterError,
  BaseMessage,
  ExtensionChannel,
  MessagingAdapter,
  PageBootstrapAdapter,
  StorageAdapter,
  TabInfo,
  TabQuery,
  TabStatus,
  TabsAdapter,
  UiAdapter,
  UserAgentAdapter,
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

/**
 * `open` lists the tabs `query({})` returns; the first one is the active tab.
 * `close` plays the user closing a tab.
 */
/**
 * Tabs in a window: the first one is the active tab. A created tab comes in front;
 * `navigations` records every page the background asked a tab to load (creation included).
 */
export const createFakeTabs = (initial: ReadonlyArray<TabInfo> = []) => {
  let open: ReadonlyArray<TabInfo> = initial;
  let nextId = 100;
  const navigations: Array<{ tabId: number; url: string }> = [];
  const handlers = new Set<(tabId: number, status: TabStatus) => void>();
  const removedHandlers = new Set<(tabId: number) => void>();
  const tabs: TabsAdapter = {
    query: (query: TabQuery) => () => Promise.resolve(query.active ? open.slice(0, 1) : open),
    create: (url) => () => {
      const id = nextId++;
      open = [{ id, url }, ...open];
      navigations.push({ tabId: id, url });
      return Promise.resolve(E.right(id));
    },
    navigate: (tabId, url) => () => {
      navigations.push({ tabId, url });
      return Promise.resolve(E.right(undefined));
    },
    onTabsUpdated: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    onTabRemoved: (handler) => {
      removedHandlers.add(handler);
      return () => removedHandlers.delete(handler);
    },
  };
  return {
    tabs,
    navigations,
    emit: (tabId: number, status: TabStatus) => {
      for (const handler of handlers) handler(tabId, status);
    },
    close: (tabId: number) => {
      open = open.filter((tab) => tab.id !== tabId);
      for (const handler of removedHandlers) handler(tabId);
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
  let respond: (message: T) => unknown = () => undefined;
  const channel: ExtensionChannel<T> = {
    request: (message) => {
      sent.push(message);
      return TE.right(respond(message));
    },
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
    /** How the other side answers `request`. */
    respondWith: (responder: (message: T) => unknown) => {
      respond = responder;
    },
  };
};

/** Background side of the UI: `request` plays the settings UI. */
export const createFakeUi = () => {
  const notified: unknown[] = [];
  let entry: { isRequest: (m: unknown) => boolean; handler: (request: never) => () => Promise<unknown> } | undefined;
  const ui: UiAdapter = {
    onRequest: (isRequest, handler) => {
      entry = { isRequest, handler: handler as never };
      return () => {
        entry = undefined;
      };
    },
    notify: (message) => () => {
      notified.push(message);
      return Promise.resolve();
    },
    pageUrl: (path) => `ext://hbb-emu/${path}`,
  };
  return {
    ui,
    notified,
    request: async (message: unknown): Promise<unknown> => {
      if (!entry?.isRequest(message)) return "ignored";
      return entry.handler(message as never)();
    },
  };
};

/** Records every user agent the background asks the browser to send. */
export const createFakeUserAgent = () => {
  const applied: string[] = [];
  const userAgent: UserAgentAdapter = {
    setUserAgent: (value) => {
      applied.push(value);
      return TE.right(undefined);
    },
  };
  return { userAgent, applied };
};

/** Records the bootstrap code published; `available: false` plays a host (or a user) that does not allow it. */
export const createFakePageBootstrap = (initiallyAvailable = true) => {
  const published: string[] = [];
  let available = initiallyAvailable;
  const pageBootstrap: PageBootstrapAdapter = {
    publish: (code) => {
      if (!available) return TE.left({ _tag: "PageBootstrapUnavailable", reason: "not allowed" });
      published.push(code);
      return TE.right(undefined);
    },
  };
  return {
    pageBootstrap,
    published,
    setAvailable: (value: boolean) => {
      available = value;
    },
  };
};
