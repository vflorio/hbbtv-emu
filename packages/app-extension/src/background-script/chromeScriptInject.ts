import { type ClassType, createLogger } from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as T from "fp-ts/Task";

const logger = createLogger("ChromeScriptInject");

export namespace ChromeScriptInject {
  export interface Contract {
    inject: Inject;
  }

  export type Inject = ({
    tabId,
    mainScripts,
    bridgeScripts,
  }: {
    tabId: number;
    mainScripts: string;
    bridgeScripts: string;
  }) => IO.IO<T.Task<void>>;
}

export const WithChromeScriptInject = <T extends ClassType>(Base: T) =>
  class extends Base implements ChromeScriptInject.Contract {
    inject: ChromeScriptInject.Inject = ({ tabId, mainScripts, bridgeScripts }) =>
      pipe(
        logger.info(`Preparing injection for tab ${tabId}`, {
          mainScripts,
          bridgeScripts,
        }),
        IO.map(() =>
          pipe(
            T.fromIO(() => {
              chrome.scripting.executeScript({
                target: { tabId },
                files: [mainScripts],
                world: "MAIN",
                injectImmediately: true,
              });
            }),
            T.flatMap(
              () => () =>
                chrome.scripting.executeScript({
                  target: { tabId },
                  files: [bridgeScripts],
                  world: "ISOLATED",
                  injectImmediately: true,
                }),
            ),
            T.flatMap(() => T.fromIO(logger.info(`Injection completed for tab ${tabId}`))),
          ),
        ),
      );
  };
