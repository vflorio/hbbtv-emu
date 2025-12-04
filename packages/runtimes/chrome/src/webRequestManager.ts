import { type ClassType, createLogger } from "@hbb-emu/core";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as N from "fp-ts/number";
import * as O from "fp-ts/Option";
import * as RS from "fp-ts/ReadonlySet";
import * as S from "fp-ts/State";
import type { ScriptInject } from "./scriptInject";

const logger = createLogger("WebRequestManager");

interface State {
  tabs: ReadonlySet<number>;
}

export const WithWebRequestManager = <T extends ClassType<State & ScriptInject>>(Base: T) =>
  class extends Base {
    constructor(...args: any[]) {
      super(...args);

      const onHeadersReceived = (
        details: chrome.webRequest.OnHeadersReceivedDetails,
      ): chrome.webRequest.BlockingResponse | undefined =>
        pipe(
          IO.Do,
          IO.tap(() => logger.info(`Found HbbTV tab: ${details.tabId}`)),
          IO.map(() => addTab(details.tabId)(this)),
          IO.of(() => processResponseHeaders(details)),
        )();

      const onTabsRemoved =
        (tabId: number): IO.IO<void> =>
        () =>
          pipe(
            logger.info(`Removing tab from HbbTV tabs set: ${tabId}`),
            IO.map(() => removeTab(tabId)(this)),
          )();

      chrome.webRequest.onHeadersReceived.addListener(
        onHeadersReceived,
        {
          urls: ["http://*/*", "https://*/*"],
          types: ["main_frame"],
        },
        ["responseHeaders"],
      );

      chrome.tabs.onRemoved.addListener(onTabsRemoved);
    }
  };

const modifyTabs = (f: (tabs: ReadonlySet<number>) => ReadonlySet<number>): S.State<State, void> =>
  pipe(
    S.get<State>(),
    S.map((state) => state.tabs),
    S.chain((tabs) =>
      S.modify((state) => ({
        ...state,
        tabs: f(tabs),
      })),
    ),
  );

const addTab = (tabId: number): S.State<State, void> => modifyTabs(RS.insert(N.Eq)(tabId));

const removeTab = (tabId: number): S.State<State, void> => modifyTabs(RS.remove(N.Eq)(tabId));

const processResponseHeaders = (
  details: chrome.webRequest.OnHeadersReceivedDetails,
): chrome.webRequest.BlockingResponse | undefined =>
  pipe(
    details.responseHeaders,
    O.fromNullable,
    O.flatMap(findContentTypeHeader),
    O.flatMap(flow(validateHbbTVHeader, O.fromEither)),
    O.map(normalizeContentType),
    O.map(applyToResponseHeaders(details)),
    O.toUndefined,
  );

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

const applyToResponseHeaders =
  (
    details: chrome.webRequest.OnHeadersReceivedDetails,
  ): ((header: chrome.webRequest.HttpHeader) => { responseHeaders: chrome.webRequest.HttpHeader[] }) =>
  (normalizedHeader) =>
    pipe(
      details.responseHeaders || [],
      A.map((h) => (h.name.toLowerCase() === "content-type" ? normalizedHeader : h)),
      (responseHeaders) => ({ responseHeaders }),
    );
