import { createLogger, type Logger } from "@hbb-emu/core";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOO from "fp-ts/IOOption";
import * as O from "fp-ts/Option";
import { match } from "ts-pattern";
import type { TabStatus, TabsAdapter, WebRequestAdapter } from "../../../adapters";

export type TabsManangerEnv = {
  tabs: TabsAdapter;
  webRequest: WebRequestAdapter;
  onTabAdded: (tabId: number) => IO.IO<void>;
  onTabRemoved: (tabId: number) => IO.IO<void>;
};

export class TabsManager {
  protected readonly tabs: number[] = [];

  constructor(
    protected readonly env: TabsManangerEnv,
    private readonly logger: Logger = createLogger("TabsManager"),
  ) {
    env.tabs.onTabsUpdated(this.onTabsUpdated);
    env.webRequest.onHeadersReceived(this.onHeadersReceived);
  }

  private readonly onTabsUpdated = (tabId: number, tabStatus: TabStatus): void =>
    pipe(
      IOO.fromNullable(tabStatus),
      IOO.filter((status) => status === "loading" || status === "unloaded"),
      IOO.tapIO((status) => this.logger.info(`Tab ${tabId} status change: ${status} `)),
      IOO.tapIO((status) =>
        match(status)
          .with("loading", () => this.env.onTabAdded(tabId))
          .with("unloaded", () => this.env.onTabRemoved(tabId))
          .exhaustive(),
      ),
      IO.asUnit,
    )();

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
      // TODO: Doublecheck
      (modifiedHeaders) => ({ responseHeaders: modifiedHeaders, ...etc }) as chrome.webRequest.OnHeadersReceivedDetails,
    );
  };
}
