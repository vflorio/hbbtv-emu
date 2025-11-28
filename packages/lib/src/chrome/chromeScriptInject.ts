import { createLogger } from "../logger";
import type { ClassType } from "../mixin";
import * as IO from "fp-ts/IO";
import * as T from "fp-ts/Task";

const logger = createLogger("Chrome Script Inject");

export interface ChromeScriptInject {
  inject(tabId: number, mainScripts: string[], bridgeScripts: string[]): IO.IO<T.Task<void>>;
}

export const WithChromeScriptInject = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeScriptInject {
    inject =
      (tabId: number, mainScripts: string[], bridgeScripts: string[]): IO.IO<T.Task<void>> =>
      () => {
        logger.log(`Preparing injection for tab ${tabId}`, {
          main: mainScripts,
          bridge: bridgeScripts,
        });

        const task: T.Task<void> = async () => {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: mainScripts,
            world: "MAIN",
            injectImmediately: true,
          });

          await chrome.scripting.executeScript({
            target: { tabId },
            files: bridgeScripts,
            world: "ISOLATED",
            injectImmediately: true,
          });

          logger.log(`Injection completed for tab ${tabId}`);
        };

        return task;
      };
  };
