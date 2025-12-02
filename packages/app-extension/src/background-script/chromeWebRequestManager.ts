import { type ClassType, createLogger, DEFAULT_HBBTV_CONFIG, type ExtensionConfig } from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import type { ChromeScriptInject } from "./chromeScriptInject";

export interface WebRequestHandler {
  tabs: Set<number>;
  stateRef: IORef.IORef<ExtensionConfig.State>;
  onHeadersReceivedListener: (
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

export const WithChromeWebRequestManager = <T extends ClassType<ChromeScriptInject>>(Base: T) =>
  class extends Base implements WebRequestHandler {
    tabs: Set<number>;
    stateRef: IORef.IORef<ExtensionConfig.State> = IORef.newIORef<ExtensionConfig.State>(DEFAULT_HBBTV_CONFIG)();

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

    onHeadersReceivedListener = (
      details: chrome.webRequest.OnHeadersReceivedDetails,
    ): chrome.webRequest.BlockingResponse | undefined =>
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
            IO.bind("state", () => this.stateRef.read),
            IO.tap(({ state }) => this.injectUserAgent(details.tabId, state.userAgent)),
            IO.tap(() => this.inject(details.tabId)),
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
