import { type ClassType, createLogger } from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";

const logger = createLogger("ChromeScriptInject");

export interface ChromeScriptInject {
  inject: (tabId: number) => IO.IO<void>;
  injectUserAgent: (tabId: number, userAgent: string) => IO.IO<void>;
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

const executeUserAgentOverride =
  (tabId: number, userAgent: string): IO.IO<void> =>
  () =>
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      injectImmediately: true,
      func: (ua: string) => {
        Object.defineProperty(navigator, "userAgent", {
          get: () => ua,
          configurable: true,
        });
      },
      args: [userAgent],
    });

const mainScripts = ["content-script.js"];
const bridgeScripts = ["bridge.js"];

export const WithChromeScriptInject = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeScriptInject {
    inject = (tabId: number): IO.IO<void> =>
      pipe(
        logger.info(`Script injection for tab ${tabId}`, {
          main: mainScripts,
          bridge: bridgeScripts,
        }),
        IO.tap(() => executeScript(tabId, mainScripts, "MAIN")),
        IO.tap(() => executeScript(tabId, bridgeScripts, "ISOLATED")),
      );

    injectUserAgent = (tabId: number, userAgent: string): IO.IO<void> =>
      pipe(
        logger.info(`Injecting userAgent override for tab ${tabId}: ${userAgent}`),
        IO.tap(() => executeUserAgentOverride(tabId, userAgent)),
      );
  };
