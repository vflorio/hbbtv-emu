import { createLogger } from "../misc";
import type { ClassType } from "../mixin";

const logger = createLogger("Chrome Script Inject");

export interface ChromeScriptInject {
  inject(tabId: number, files: string[]): void;
}

export const WithChromeScriptInject = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeScriptInject {
    inject = (tabId: number, files: string[]) => {
      chrome.scripting
        .executeScript({
          target: { tabId },
          files: ["bridge.js"],
          world: "ISOLATED",
          injectImmediately: true,
        })
        .catch((error) => {
          logger.error("Failed to inject bridge script:", error);
        });

      return chrome.scripting
        .executeScript({
          target: { tabId },
          files,
          world: "MAIN",
          injectImmediately: true,
        })
        .catch((error) => {
          logger.error("Failed to inject HbbTV APIs:", error);
        });
    };
  };
