export class WebRequestManager {
  private tabs: Set<number>;

  constructor(onHbbtvTabDetected: (tabId: number) => void) {
    this.tabs = new Set<number>();

    chrome.webRequest.onHeadersReceived.addListener(
      onHeadersReceivedListener((tabId: number) => {
        this.tabs.add(tabId);

        onHbbtvTabDetected(tabId);
      }),
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
}

const onHeadersReceivedListener =
  (onReceived: (tabId: number) => void) => (details: chrome.webRequest.OnHeadersReceivedDetails) => {
    const contentTypeHeader = (details.responseHeaders || []).find(
      (header) => header.name.toLowerCase() === "content-type",
    );

    if (!contentTypeHeader) return;

    const contentType = contentTypeHeader?.value?.toLowerCase() || "";
    if (!contentType.includes("application/vnd.hbbtv.xhtml+xml")) return;

    onReceived(details.tabId);

    // Prevent chrome from downloading the content
    contentTypeHeader.value = "application/xhtml+xml";

    return { responseHeaders: details.responseHeaders };
  };
