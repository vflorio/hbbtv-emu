import type { ClassType } from "../mixin";

export interface ChromeScriptInject {
  inject(tabId: number, files: string[]): void;
}

export const WithChromeScriptInject = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeScriptInject {
    inject = (tabId: number, files: string[]) =>
      chrome.scripting
        .executeScript({
          target: { tabId },
          files,
          world: "MAIN",
          injectImmediately: true,
        })
        .catch((error) => {
          console.error("Failed to inject HbbTV APIs:", error);
        });
  };
