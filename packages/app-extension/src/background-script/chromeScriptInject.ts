import { type ClassType, createLogger } from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as T from "fp-ts/Task";

const logger = createLogger("Chrome Script Inject");

export interface ChromeScriptInject {
  inject(tabId: number, mainScripts: string[], bridgeScripts: string[]): IO.IO<T.Task<void>>;
}

export const WithChromeScriptInject = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeScriptInject {
    inject = (tabId: number, mainScripts: string[], bridgeScripts: string[]): IO.IO<T.Task<void>> =>
      pipe(
        logger.info(`Preparing injection for tab ${tabId}`, {
          main: mainScripts,
          bridge: bridgeScripts,
        }),
        IO.map(() => {
          const task: T.Task<void> = pipe(
            T.fromIO(() => {
              chrome.scripting.executeScript({
                target: { tabId },
                files: mainScripts,
                world: "MAIN",
                injectImmediately: true,
              });
            }),
            T.flatMap(
              () => () =>
                chrome.scripting.executeScript({
                  target: { tabId },
                  files: bridgeScripts,
                  world: "ISOLATED",
                  injectImmediately: true,
                }),
            ),
            T.flatMap(() => T.fromIO(logger.info(`Injection completed for tab ${tabId}`))),
          );

          return task;
        }),
      );
  };
