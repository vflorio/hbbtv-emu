import type { Logger } from "@hbb-emu/core";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import type { TabsAdapter, WebRequestAdapter } from "../../../adapter";

export type TabsManangerEnv = {
  logger: Logger;
  tabs: TabsAdapter;
  webRequest: WebRequestAdapter;
  handlers: {
    /** The tab was closed. */
    onTabRemoved: (tabId: number) => IO.IO<void>;
  };
};

export class TabsManager {
  private readonly logger: Logger;

  constructor(protected readonly env: TabsManangerEnv) {
    this.logger = env.logger.create("TabsManager");

    this.env.tabs.onTabRemoved(this.onTabRemoved);
    this.env.webRequest.onHeadersReceived(this.onHeadersReceived);
  }

  /**
   * Only closing a tab ends what happens in it: navigations and reloads do not
   * (nor a tab being discarded to save memory: it reloads in place).
   */
  private readonly onTabRemoved = (tabId: number): void =>
    pipe(
      this.logger.debug(`Tab ${tabId} closed`),
      IO.flatMap(() => this.env.handlers.onTabRemoved(tabId)),
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
      (modifiedHeaders) => ({ responseHeaders: modifiedHeaders, ...etc }) as chrome.webRequest.OnHeadersReceivedDetails,
    );
  };
}
