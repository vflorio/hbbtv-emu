// Open sidepanel when extension action is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.windowId) return;

  await chrome.sidePanel.open({
    tabId: tab.id,
    windowId: tab.windowId,
  });
});

const onHeadersReceivedListener = (
  details: chrome.webRequest.OnHeadersReceivedDetails
) => {
  const contentTypeHeader = (details.responseHeaders || []).find(
    (header) => header.name.toLowerCase() === "content-type"
  );

  if (!contentTypeHeader) return;

  const contentType = contentTypeHeader?.value?.toLowerCase() || "";
  if (!contentType.includes("application/vnd.hbbtv.xhtml+xml")) return;

  // Prevent chrome from downloading the content
  contentTypeHeader.value = "application/xhtml+xml";

  return { responseHeaders: details.responseHeaders };
};

chrome.webRequest.onHeadersReceived.addListener(
  onHeadersReceivedListener,
  {
    urls: ["http://*/*", "https://*/*"],
    types: ["main_frame"],
  },
  ["responseHeaders"]
);
