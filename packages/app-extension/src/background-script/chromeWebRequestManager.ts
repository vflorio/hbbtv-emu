import { type ClassType, createLogger } from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import type { ChromeScriptInject } from "./chromeScriptInject";

export namespace WebRequestHandler {
  export interface Contract {
    tabs: Set<number>;
    onHeadersReceivedListener: OnHeadersReceivedListener;
  }

  export type OnHeadersReceivedListener = (
    details: chrome.webRequest.OnHeadersReceivedDetails,
  ) => chrome.webRequest.BlockingResponse | undefined;
}

const logger = createLogger("ChromeWebRequestManager");

const findContentTypeHeader = (headers: chrome.webRequest.HttpHeader[]): O.Option<chrome.webRequest.HttpHeader> =>
  pipe(
    headers,
    A.findFirst((h) => h.name.toLowerCase() === "content-type"),
  );

const isHbbTVContentType = (contentType: string): boolean =>
  contentType.toLowerCase().includes("application/vnd.hbbtv.xhtml+xml");

const validateHbbTVHeader = (header: chrome.webRequest.HttpHeader): E.Either<string, chrome.webRequest.HttpHeader> =>
  pipe(
    O.fromNullable(header.value),
    O.filter(isHbbTVContentType),
    E.fromOption(() => "Not HbbTV content type"),
    E.map(() => header),
  );

const normalizeContentType = (header: chrome.webRequest.HttpHeader): chrome.webRequest.HttpHeader => ({
  ...header,
  value: "application/xhtml+xml",
});

export const WithChromeWebRequestManager = <T extends ClassType<ChromeScriptInject.Contract>>(Base: T) =>
  class extends Base implements WebRequestHandler.Contract {
    tabs: Set<number>;

    constructor(...args: any[]) {
      super(...args);
      this.tabs = new Set<number>();

      chrome.webRequest.onHeadersReceived.addListener(
        this.onHeadersReceivedListener,
        { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
        ["responseHeaders"],
      );

      chrome.tabs.onRemoved.addListener((tabId) => {
        pipe(
          logger.info(`Tab removed: ${tabId}`),
          IO.flatMap(() => () => this.tabs.delete(tabId)),
        )();
      });
    }

    injectScripts = (tabId: number): IO.IO<void> =>
      pipe(
        IO.Do,
        IO.flatMap(() =>
          this.inject({
            tabId,
            bridgeScripts: "bridge.js",
            mainScripts: "content-script.js",
          }),
        ),
        IO.flatMap(() => logger.info(`Injection completed for tab ${tabId}`)),
      );

    onHeadersReceivedListener: WebRequestHandler.OnHeadersReceivedListener = (details) =>
      pipe(
        details.responseHeaders,
        O.fromNullable,
        O.flatMap(findContentTypeHeader),
        O.flatMap(flow(validateHbbTVHeader, O.fromEither)),
        O.map((header) => {
          pipe(
            IO.Do,
            IO.tap(() => () => this.tabs.add(details.tabId)),
            IO.tap(() => logger.info(`Tab added: ${details.tabId}`)),
            IO.tap(() => this.injectScripts(details.tabId)),
          )();

          return normalizeContentType(header);
        }),
        O.map((normalizedHeader) =>
          pipe(
            details.responseHeaders || [],
            A.map((h) => (h.name.toLowerCase() === "content-type" ? normalizedHeader : h)),
            (responseHeaders) => ({ responseHeaders }),
          ),
        ),
        O.toUndefined,
      );
  };
