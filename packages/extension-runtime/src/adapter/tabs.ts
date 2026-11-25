import type * as T from "fp-ts/Task";
import { match } from "ts-pattern";
import type { UnsubscribeFn } from "..";
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
}

const toTabInfos = (tabs: ReadonlyArray<chrome.tabs.Tab>): ReadonlyArray<TabInfo> =>
  tabs.flatMap((tab) => (tab.id === undefined ? [] : [{ id: tab.id, url: tab.url }]));

/**
 * @since Chrome 4+ Firefox 45+
 */
export const createTabsAdapter = ({ manifest }: AdapterConfig): TabsAdapter => ({
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
});
