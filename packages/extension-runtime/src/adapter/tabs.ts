import type { UnsubscribeFn } from "..";
import type { AdapterConfig } from ".";

export type TabStatus = "unloaded" | "loading" | "complete";

export interface TabsAdapter {
  onTabsUpdated: (handler: (tabId: number, status: TabStatus) => void) => UnsubscribeFn;
}

/**
 * @since Chrome 4+ Firefox 45+
 */
export const createTabsAdapter = (_: AdapterConfig): TabsAdapter => ({
  onTabsUpdated: (handler) => {
    const listener = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
      if (!changeInfo.status) return;
      handler(tabId, changeInfo.status);
    };

    chrome.tabs.onUpdated.addListener(listener);
    return () => chrome.tabs.onUpdated.removeListener(listener);
  },
});
