import { type ClassType, createLogger } from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";

const logger = createLogger("ChromeScriptInject");

export namespace ChromeScriptInject {
  export interface Contract {
    inject: Inject;
  }

  export type Inject = (tabId: number) => IO.IO<void>;
}

const executeScript =
  (tabId: number, files: string[], world: "MAIN" | "ISOLATED"): IO.IO<void> =>
  () =>
    chrome.scripting.executeScript({
      target: { tabId },
      files,
      world,
      injectImmediately: true,
    });

const mainScripts = ["content-script.js"];
const bridgeScripts = ["bridge.js"];

export const WithChromeScriptInject = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeScriptInject.Contract {
    inject: ChromeScriptInject.Inject = (tabId) =>
      pipe(
        logger.info(`Script injection for tab ${tabId}`, {
          main: mainScripts,
          bridge: bridgeScripts,
        }),
        IO.tap(() => executeScript(tabId, mainScripts, "MAIN")),
        IO.tap(() => executeScript(tabId, bridgeScripts, "ISOLATED")),
      );
  };
