import { createLogger } from "@hbb-emu/core";
import { BackgroundScript } from "@hbb-emu/extension-runtime";

new BackgroundScript(createLogger("Firefox Background"), {
  webRequest: {
    onHeadersReceived: (handler) => {
      const listener = (
        details: browser.webRequest._OnHeadersReceivedDetails,
      ): browser.webRequest.BlockingResponse | Promise<browser.webRequest.BlockingResponse> => handler(details);

      browser.webRequest.onHeadersReceived.addListener(listener, { urls: ["<all_urls>"] }, [
        "responseHeaders",
        "blocking",
      ]);

      return () => browser.webRequest.onHeadersReceived.removeListener(listener);
    },
  },
  tabs: {
    onTabsUpdated: (handler) => {
      const listener = (tabId: number, changeInfo: browser.tabs._OnUpdatedChangeInfo) => {
        if (!changeInfo.status) return;
        handler(tabId, changeInfo.status as "unloaded" | "loading" | "complete");
      };

      browser.tabs.onUpdated.addListener(listener);
      return () => browser.tabs.onUpdated.removeListener(listener);
    },
  },
});
