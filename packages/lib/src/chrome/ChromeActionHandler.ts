import type { ClassType } from "../mixin";

interface ActionHandler {
  onActionClicked(tab: chrome.tabs.Tab): Promise<void>;
}

export const WithChromeActionHandler = <T extends ClassType>(Base: T) =>
  class extends Base implements ActionHandler {
    constructor(...args: any[]) {
      super(...args);
      chrome.action.onClicked.addListener(this.onActionClicked);
    }

    onActionClicked = async (tab: chrome.tabs.Tab) => {
      if (!tab.id || !tab.windowId) return;

      await chrome.sidePanel.open({
        tabId: tab.id,
        windowId: tab.windowId,
      });
    };
  };
