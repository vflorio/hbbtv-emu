import { WebRequestManager } from "./WebRequestManager";

// Open sidepanel when extension action is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.windowId) return;

  await chrome.sidePanel.open({
    tabId: tab.id,
    windowId: tab.windowId,
  });
});

const onHbbtvTabDetected = (tabId: number) => {
  chrome.scripting
    .executeScript({
      target: { tabId },
      files: ["inject.js"],
      world: "MAIN",
    })
    .catch((error) => {
      console.error("Failed to inject HbbTV APIs:", error);
    });
};

new WebRequestManager(onHbbtvTabDetected);
