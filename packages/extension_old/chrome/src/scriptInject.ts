import { type ClassType, createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";

const logger = createLogger("ChromeScriptInject");

export interface ChromeScriptInject {
  inject: (tabId: number) => IO.IO<void>;
}

export const WithChromeScriptInject = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeScriptInject {
    inject = (tabId: number): IO.IO<void> =>
      pipe(
        logger.info(`Starting content script injection for tab ${tabId}`),
        IO.tap(() => executeScript(tabId, ["content-script.js"], "MAIN")),
      );
  };

const executeScript =
  (tabId: number, files: string[], world: "MAIN" | "ISOLATED"): IO.IO<void> =>
  () =>
    chrome.scripting.executeScript({
      target: { tabId },
      files,
      world,
      injectImmediately: true,
    });
