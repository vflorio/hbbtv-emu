import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import { type AdapterConfig, type AdapterError, MANIFEST_VERSION_2, MANIFEST_VERSION_3 } from "./adapter";

/**
 * The user agent the emulated TV sends over HTTP, on every request (documents,
 * scripts, media, XHR…), like a real TV. In the page, `navigator.userAgent` is the
 * page runtime's job.
 */
export interface UserAgentAdapter {
  readonly setUserAgent: (userAgent: string) => TE.TaskEither<AdapterError, void>;
}

export const USER_AGENT_RULE_ID = 1000;

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

const userAgentRule = (userAgent: string): chrome.declarativeNetRequest.Rule => ({
  id: USER_AGENT_RULE_ID,
  priority: 1,
  action: {
    type: "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType,
    requestHeaders: [
      { header: "User-Agent", operation: "set" as chrome.declarativeNetRequest.HeaderOperation, value: userAgent },
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

/** MV2 / Firefox: a blocking listener that reads the current value. */
const webRequestUserAgent = (): UserAgentAdapter => {
  let current: string | undefined;
  let installed = false;

  const listener = (details: chrome.webRequest.OnBeforeSendHeadersDetails): chrome.webRequest.BlockingResponse => {
    if (current === undefined || !details.requestHeaders) return {};
    const others = details.requestHeaders.filter((header) => header.name.toLowerCase() !== "user-agent");
    return { requestHeaders: [...others, { name: "User-Agent", value: current }] };
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
