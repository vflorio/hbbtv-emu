import { pipe } from "fp-ts/function";
import type * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import type { AdapterError, UnsubscribeFn } from "..";
import { type AdapterConfig, MANIFEST_VERSION_2, MANIFEST_VERSION_3 } from "./adapter";

export type TabStatus = "unloaded" | "loading" | "complete";

export type TabInfo = Readonly<{ id: number; url?: string }>;

export type TabQuery = Readonly<{ active?: boolean; lastFocusedWindow?: boolean }>;

export interface TabsAdapter {
  onTabsUpdated: (handler: (tabId: number, status: TabStatus) => void) => UnsubscribeFn;
  /** A tab was closed (or its window was). */
  onTabRemoved: (handler: (tabId: number) => void) => UnsubscribeFn;
  /** Tabs matching the query (all tabs for `{}`); never fails, returns [] instead. */
  query: (query: TabQuery) => T.Task<ReadonlyArray<TabInfo>>;
  /** Opens a new tab on `url`, in front. Returns its id. */
  create: (url: string) => TE.TaskEither<AdapterError, number>;
  /** Loads `url` in the tab, as if the user had followed a link. */
  navigate: (tabId: number, url: string) => TE.TaskEither<AdapterError, void>;
}

const tabError = (cause: unknown): AdapterError => ({ _tag: "TabError", cause });

const toTabInfos = (tabs: ReadonlyArray<chrome.tabs.Tab>): ReadonlyArray<TabInfo> =>
  tabs.flatMap((tab) => (tab.id === undefined ? [] : [{ id: tab.id, url: tab.url }]));

/**
 * @since Chrome 4+ Firefox 45+
 */
export const createTabsAdapter = ({ manifest }: AdapterConfig): TabsAdapter => {
  /** `chrome.tabs` takes callbacks on MV2 (Firefox's `chrome.*` too), returns promises on MV3. */
  const call = <A>(withCallback: (done: (result: A) => void) => void, withPromise: () => Promise<A>) =>
    TE.tryCatch(
      () =>
        match(manifest)
          .with(
            MANIFEST_VERSION_2,
            () =>
              new Promise<A>((resolve, reject) =>
                withCallback((result) => {
                  const error = chrome.runtime.lastError;
                  if (error) reject(error);
                  else resolve(result);
                }),
              ),
          )
          .with(MANIFEST_VERSION_3, withPromise)
          .exhaustive(),
      tabError,
    );

  return {
    create: (url) =>
      pipe(
        call<chrome.tabs.Tab>(
          (done) => chrome.tabs.create({ url, active: true }, done),
          () => chrome.tabs.create({ url, active: true }),
        ),
        TE.flatMap((tab) => (tab.id === undefined ? TE.left(tabError("The new tab has no id")) : TE.right(tab.id))),
      ),

    navigate: (tabId, url) =>
      pipe(
        call<chrome.tabs.Tab | undefined>(
          (done) => chrome.tabs.update(tabId, { url }, done),
          () => chrome.tabs.update(tabId, { url }),
        ),
        TE.asUnit,
      ),

    query: (query) => () =>
      match(manifest)
        .with(
          MANIFEST_VERSION_2,
          () => new Promise<ReadonlyArray<chrome.tabs.Tab>>((resolve) => chrome.tabs.query(query, resolve)),
        )
        .with(MANIFEST_VERSION_3, () => chrome.tabs.query(query))
        .exhaustive()
        .then(toTabInfos, () => []),

    onTabsUpdated: (handler) => {
      const listener = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
        if (!changeInfo.status) return;
        handler(tabId, changeInfo.status);
      };

      chrome.tabs.onUpdated.addListener(listener);
      return () => chrome.tabs.onUpdated.removeListener(listener);
    },

    onTabRemoved: (handler) => {
      const listener = (tabId: number) => handler(tabId);
      chrome.tabs.onRemoved.addListener(listener);
      return () => chrome.tabs.onRemoved.removeListener(listener);
    },
  };
};
