// Background script per la Chrome extension
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id && tab.windowId) {
    await chrome.sidePanel.open({ 
      tabId: tab.id,
      windowId: tab.windowId 
    });
  }
});

// Configurazione iniziale
chrome.runtime.onInstalled.addListener(() => {
  // Extension installed successfully
});