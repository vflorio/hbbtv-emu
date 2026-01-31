import type { Logger } from "@hbb-emu/core";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOO from "fp-ts/IOOption";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import { match } from "ts-pattern";
import type { TabStatus, TabsAdapter, WebRequestAdapter } from "../../../adapter";
import type { StateManager } from "./state";

export type TabsManangerEnv = {
  logger: Logger;
  tabs: TabsAdapter;
  webRequest: WebRequestAdapter;
  stateManager: StateManager;
  handlers: {
    onTabAdded: (tabId: number) => IO.IO<void>;
    onTabRemoved: (tabId: number) => IO.IO<void>;
  };
};

export class TabsManager {
  protected readonly tabs: number[] = [];
  private readonly logger: Logger;

  constructor(protected readonly env: TabsManangerEnv) {
    this.logger = env.logger.create("TabsManager");

    this.env.tabs.onTabsUpdated(this.onTabsUpdated);
    this.env.webRequest.onHeadersReceived(this.onHeadersReceived);
  }

  private readonly onTabsUpdated = (tabId: number, tabStatus: TabStatus): void =>
    pipe(
      IOO.fromNullable(tabStatus),
      IOO.filter((status) => status === "loading" || status === "unloaded"),
      IOO.tapIO((status) =>
        match(status)
          .with("loading", () =>
            pipe(
              IO.Do,
              IO.tap(() => this.enableTab(tabId)),
              IO.tap(() => this.env.handlers.onTabAdded(tabId)),
              IO.tap(() => this.logger.info(`Tab ${tabId} Loading`)),
            ),
          )
          .with("unloaded", () =>
            pipe(
              IO.Do,
              IO.tap(() => this.disableTab(tabId)),
              IO.tap(() => this.env.handlers.onTabRemoved(tabId)),
              IO.tap(() => this.logger.info(`Tab ${tabId} Unloaded`)),
            ),
          )
          .exhaustive(),
      ),
      IO.asUnit,
    )();

  private readonly enableTab = (tabId: number): T.Task<void> =>
    pipe(
      this.env.stateManager.updateState((state) => ({
        ...state,
        enabledTabIds: new Set([...state.enabledTabIds, tabId]),
      })),
    );

  private readonly disableTab = (tabId: number): T.Task<void> =>
    pipe(
      this.env.stateManager.updateState((state) => {
        const enabledTabIds = new Set(state.enabledTabIds);
        enabledTabIds.delete(tabId);
        return { ...state, enabledTabIds };
      }),
    );

  private readonly onHeadersReceived = ({
    responseHeaders = [],
    type,
    ...etc
  }: chrome.webRequest.OnHeadersReceivedDetails): chrome.webRequest.OnHeadersReceivedDetails => {
    const contentTypeHeader = responseHeaders.find((header) => header.name?.toLowerCase() === "content-type");

    const isHbbtvApp = contentTypeHeader?.value?.includes("application/vnd.hbbtv");
    const isHtmlDocument = type === "main_frame" || type === "sub_frame";

    if (!isHtmlDocument || !isHbbtvApp) {
      return { responseHeaders, type, ...etc };
    }

    const updateFirst =
      (
        predicate: (a: chrome.webRequest.HttpHeader) => boolean,
        map: (a: chrome.webRequest.HttpHeader) => chrome.webRequest.HttpHeader,
      ) =>
      (as: chrome.webRequest.HttpHeader[]): chrome.webRequest.HttpHeader[] =>
        pipe(
          as,
          A.findIndex(predicate),
          O.match(
            () => as,
            (index) =>
              pipe(
                as,
                A.modifyAt(index, map),
                O.getOrElse(() => as),
              ),
          ),
        );

    return pipe(
      responseHeaders,
      updateFirst(
        (header) => header.name?.toLowerCase() === "content-type",
        (header) => ({ ...header, value: "application/xhtml+xml" }),
      ),
      (modifiedHeaders) => ({ responseHeaders: modifiedHeaders, ...etc }) as chrome.webRequest.OnHeadersReceivedDetails,
    );
  };
}
