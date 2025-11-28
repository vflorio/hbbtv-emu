import { createLogger } from "../logger";
import type { ClassType } from "../mixin";

const logger = createLogger("Chrome Script Inject");

export interface ChromeScriptInject {
  inject(tabId: number, main: string[], bridge: string[]): Promise<void>;
}

export const WithChromeScriptInject = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeScriptInject {
    inject = async (tabId: number, main: string[], bridge: string[]) => {
      logger.log(`Injecting scripts into tab ${tabId}:`, { main, bridge });

      await chrome.scripting.executeScript({
        target: { tabId },
        files: main,
        world: "MAIN",
        injectImmediately: true,
      });

      await chrome.scripting.executeScript({
        target: { tabId },
        files: bridge,
        world: "ISOLATED",
        injectImmediately: true,
      });
    };
  };
