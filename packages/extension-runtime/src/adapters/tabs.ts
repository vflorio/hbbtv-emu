import type { ManifestVersion, TabStatus, UnsubscribeFn } from ".";

export interface TabsAdapter {
  onTabsUpdated: (handler: (tabId: number, status: TabStatus) => void) => UnsubscribeFn;
}

/**
 * @since Chrome 4+ Firefox 45+
 */
export const createTabsAdapter = (_manifestVersion: ManifestVersion): TabsAdapter => ({
  onTabsUpdated: (handler) => {
    const listener = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
      if (!changeInfo.status) return;
      handler(tabId, changeInfo.status);
    };

    chrome.tabs.onUpdated.addListener(listener);
    return () => chrome.tabs.onUpdated.removeListener(listener);
  },
});
