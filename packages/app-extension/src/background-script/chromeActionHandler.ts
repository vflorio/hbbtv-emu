import type { ClassType } from "@hbb-emu/lib";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";

export namespace ActionHandler {
  export interface Contract {
    onActionClicked: OnActionClicked;
  }

  export type OnActionClicked = (tab: chrome.tabs.Tab) => TE.TaskEither<Error, void>;
}

export const WithChromeActionHandler = <T extends ClassType>(Base: T) =>
  class extends Base implements ActionHandler.Contract {
    constructor(...args: any[]) {
      super(...args);

      chrome.action.onClicked.addListener((tab) => {
        this.onActionClicked(tab)();
      });
    }

    onActionClicked: ActionHandler.OnActionClicked = (tab) =>
      pipe(
        E.Do,
        E.bind("tabId", () => E.fromNullable(new Error("Tab ID is missing"))(tab.id)),
        E.bind("windowId", () => E.fromNullable(new Error("Window ID is missing"))(tab.windowId)),
        TE.fromEither,
        TE.flatMap(({ tabId, windowId }) =>
          TE.tryCatch(
            () => chrome.sidePanel.open({ tabId, windowId }),
            (error) => new Error(`Failed to open side panel: ${error}`),
          ),
        ),
      );
  };
