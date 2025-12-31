import { createLogger } from "@hbb-emu/core";
import { BackgroundScript } from "@hbb-emu/extension-runtime";

new BackgroundScript(createLogger("ChromeV2 Background"), {
  webRequest: {
    onHeadersReceived: (handler) => {
      const listener = (
        details: chrome.webRequest.OnHeadersReceivedDetails,
      ): chrome.webRequest.BlockingResponse | undefined => {
        const result = handler(details as any);
        return { responseHeaders: result.responseHeaders };
      };

      chrome.webRequest.onHeadersReceived.addListener(listener, { urls: ["<all_urls>"] }, [
        "responseHeaders",
        "blocking",
        "extraHeaders",
      ]);

      return () => chrome.webRequest.onHeadersReceived.removeListener(listener);
    },
  },
  tabs: {
    onTabsUpdated: (handler) => {
      const listener = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
        if (changeInfo.status) {
          handler(tabId, changeInfo.status as "unloaded" | "loading" | "complete");
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      return () => chrome.tabs.onUpdated.removeListener(listener);
    },
  },
});
