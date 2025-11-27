import type { ClassType } from "../mixin";
import type { ChromeScriptInject } from "./ChromeScriptInject";

export interface WebRequestHandler {
  tabs: Set<number>;
}

export const WithChromeWebRequestManager = <T extends ClassType<ChromeScriptInject>>(Base: T) =>
  class extends Base implements WebRequestHandler {
    tabs: Set<number>;

    constructor(...args: any[]) {
      super(...args);
      this.tabs = new Set<number>();

      chrome.webRequest.onHeadersReceived.addListener(
        this.onHeadersReceivedListener,
        {
          urls: ["http://*/*", "https://*/*"],
          types: ["main_frame"],
        },
        ["responseHeaders"],
      );

      chrome.tabs.onRemoved.addListener((tabId) => {
        this.tabs.delete(tabId);
      });
    }

    onHeadersReceivedListener = (details: chrome.webRequest.OnHeadersReceivedDetails) => {
      const contentTypeHeader = (details.responseHeaders || []).find(
        (header) => header.name.toLowerCase() === "content-type",
      );

      if (!contentTypeHeader) return;

      const contentType = contentTypeHeader?.value?.toLowerCase() || "";
      if (!contentType.includes("application/vnd.hbbtv.xhtml+xml")) return;

      this.tabs.add(details.tabId);
      this.inject(details.tabId, ["content-script.js"], ["bridge.js"]);

      // Prevent chrome from downloading the content
      contentTypeHeader.value = "application/xhtml+xml";

      return { responseHeaders: details.responseHeaders };
    };
  };
