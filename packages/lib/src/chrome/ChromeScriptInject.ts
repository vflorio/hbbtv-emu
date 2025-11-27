import { createLogger } from "../misc";
import type { ClassType } from "../mixin";

const logger = createLogger("Chrome Script Inject");

export interface ChromeScriptInject {
  inject(tabId: number, main: string[], bridge: string[]): void;
}

export const WithChromeScriptInject = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeScriptInject {
    inject = (tabId: number, main: string[], bridge: string[]) => {
      chrome.scripting
        .executeScript({
          target: { tabId },
          files: bridge,
          world: "ISOLATED",
          injectImmediately: true,
        })
        .catch((error) => {
          logger.error("Failed to inject bridge script:", error);
        })
        .then(() => {
          logger.log("Bridge script injected successfully");
        });

      chrome.scripting
        .executeScript({
          target: { tabId },
          files: main,
          world: "MAIN",
          injectImmediately: true,
        })
        .catch((error) => {
          logger.error("Failed to inject HbbTV APIs:", error);
        })
        .then(() => {
          logger.log("HbbTV APIs injected successfully");
        });
    };
  };
