import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import { type AdapterConfig, type AdapterError, MANIFEST_VERSION_2, MANIFEST_VERSION_3 } from "./adapter";

/**
 * The user agent the emulated TV sends over HTTP, on every request (documents,
 * scripts, media, XHR…), like a real TV. In the page, `navigator.userAgent` is the
 * page runtime's job.
 *
 * The browser's User-Agent Client Hints go: Chromium sends `Sec-CH-UA*` to every secure
 * origin (an application's HTTPS ad server, say), and they name the real browser, against
 * the TV's user agent. So does its device memory (`Device-Memory`, to a server that asks),
 * which the page's `navigator.deviceMemory` does not have either. Choice of the emulator:
 * the emulated TV sends none, as a browser from before them (Chromium < 89, WebKit, Gecko).
 */
export interface UserAgentAdapter {
  readonly setUserAgent: (userAgent: string) => TE.TaskEither<AdapterError, void>;
}

export const USER_AGENT_RULE_ID = 1000;

/**
 * Every User-Agent Client Hint request header (WICG UA-CH, and Chromium's form factors):
 * the low-entropy ones Chromium sends by default, the others when a server asks (`Accept-CH`);
 * and the device memory hints, which a server asks for the same way.
 */
export const CLIENT_HINT_HEADERS = [
  "Sec-CH-UA",
  "Sec-CH-UA-Arch",
  "Sec-CH-UA-Bitness",
  "Sec-CH-UA-Form-Factors",
  "Sec-CH-UA-Full-Version",
  "Sec-CH-UA-Full-Version-List",
  "Sec-CH-UA-Mobile",
  "Sec-CH-UA-Model",
  "Sec-CH-UA-Platform",
  "Sec-CH-UA-Platform-Version",
  "Sec-CH-UA-WoW64",
  // The machine's memory, in GiB: the Device Memory spec's header and its `Sec-CH-` form.
  "Device-Memory",
  "Sec-CH-Device-Memory",
] as const;

const isClientHint = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower.startsWith("sec-ch-ua") || lower === "device-memory" || lower === "sec-ch-device-memory";
};

/** Every resource type: without a list, DNR would leave the document request out. */
const ALL_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "media",
  "websocket",
  "other",
] as chrome.declarativeNetRequest.ResourceType[];

/** MV3: the TV's user agent, and no client hints. */
export const userAgentRule = (userAgent: string): chrome.declarativeNetRequest.Rule => ({
  id: USER_AGENT_RULE_ID,
  priority: 1,
  action: {
    type: "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType,
    requestHeaders: [
      { header: "User-Agent", operation: "set" as chrome.declarativeNetRequest.HeaderOperation, value: userAgent },
      ...CLIENT_HINT_HEADERS.map((header) => ({
        header,
        operation: "remove" as chrome.declarativeNetRequest.HeaderOperation,
      })),
    ],
  },
  condition: { urlFilter: "|http", resourceTypes: ALL_RESOURCE_TYPES },
});

/** MV3: a session rule (rewritten on every change, gone when the browser closes). */
const declarativeUserAgent = (): UserAgentAdapter => ({
  setUserAgent: (userAgent) =>
    TE.tryCatch(
      () =>
        chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [USER_AGENT_RULE_ID],
          addRules: [userAgentRule(userAgent)],
        }),
      (cause): AdapterError => ({ _tag: "UserAgentOverrideError", cause }),
    ),
});

/** MV2 / Firefox: a request's headers with the TV's user agent, and no client hints. */
export const withUserAgent = (
  headers: ReadonlyArray<chrome.webRequest.HttpHeader>,
  userAgent: string,
): chrome.webRequest.HttpHeader[] => [
  ...headers.filter(({ name }) => name.toLowerCase() !== "user-agent" && !isClientHint(name)),
  { name: "User-Agent", value: userAgent },
];

/** MV2 / Firefox: a blocking listener that reads the current value. */
const webRequestUserAgent = (): UserAgentAdapter => {
  let current: string | undefined;
  let installed = false;

  const listener = (details: chrome.webRequest.OnBeforeSendHeadersDetails): chrome.webRequest.BlockingResponse => {
    if (current === undefined || !details.requestHeaders) return {};
    return { requestHeaders: withUserAgent(details.requestHeaders, current) };
  };

  return {
    setUserAgent: (userAgent) =>
      TE.tryCatch(
        async () => {
          current = userAgent;
          if (!installed) {
            chrome.webRequest.onBeforeSendHeaders.addListener(listener, { urls: ["http://*/*", "https://*/*"] }, [
              "blocking",
              "requestHeaders",
            ]);
            installed = true;
          }
        },
        (cause): AdapterError => ({ _tag: "UserAgentOverrideError", cause }),
      ),
  };
};

/**
 * @since Chrome 101+ (MV3 session rules), Chrome 17+ / Firefox 45+ (MV2 blocking webRequest)
 */
export const createUserAgentAdapter = ({ manifest }: AdapterConfig): UserAgentAdapter =>
  match(manifest)
    .with(MANIFEST_VERSION_3, declarativeUserAgent)
    .with(MANIFEST_VERSION_2, webRequestUserAgent)
    .exhaustive();
