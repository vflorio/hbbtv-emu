import { type ClassType, createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";

const logger = createLogger("ScriptInject");

export interface ScriptInject {
  inject: (tabId: number) => IO.IO<void>;
}

export const WithScriptInject = <T extends ClassType>(Base: T) =>
  class extends Base implements ScriptInject {
    inject = (tabId: number): IO.IO<void> =>
      pipe(
        logger.info(`Starting script injection for tab ${tabId}`),
        IO.tap(() => executeScript(tabId, ["content-script.js"], "MAIN")),
        IO.tap(() => executeScript(tabId, ["bridge.js"], "ISOLATED")),
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
