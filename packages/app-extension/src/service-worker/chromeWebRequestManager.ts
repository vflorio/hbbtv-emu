import { type ClassType, createLogger } from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import type { ChromeScriptInject } from "./chromeScriptInject";

export interface WebRequestHandler {
  tabs: Set<number>;
}

const logger = createLogger("Chrome WebRequest Manager");

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

    constructor(...args: any[]) {
      super(...args);
      this.tabs = new Set<number>();

      chrome.webRequest.onHeadersReceived.addListener(
        this.onHeadersReceivedListener,
        { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
        ["responseHeaders"],
      );

      chrome.tabs.onRemoved.addListener((tabId) => {
        logger.log(`Tab removed: ${tabId}`);
        this.tabs.delete(tabId);
      });
    }

    onHeadersReceivedListener = (details: chrome.webRequest.OnHeadersReceivedDetails) =>
      pipe(
        details.responseHeaders,
        O.fromNullable,
        O.flatMap(findContentTypeHeader),
        O.flatMap(flow(validateHbbTVHeader, O.fromEither)),
        O.map((header) => {
          this.tabs.add(details.tabId);
          logger.log(`Tab added: ${details.tabId}`);

          pipe(
            this.inject(details.tabId, ["content-script.js"], ["bridge.js"]),
            IO.map(T.map(() => logger.log(`Injection completed for tab ${details.tabId}`))),
            (ioTask) => ioTask()(),
          );

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
