import { type ClassType, createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";

const logger = createLogger("UserAgentManager");

export interface UserAgentManager {
  updateUserAgent: (userAgent: string) => IO.IO<void>;
}

export const WithUserAgentManager = <T extends ClassType>(Base: T) =>
  class extends Base implements UserAgentManager {
    updateUserAgent = (userAgent: string): IO.IO<void> =>
      pipe(
        updateSessionRules(userAgent),
        IO.tap(() => logger.info("User-Agent updated to:", userAgent)),
      );
  };

const updateSessionRules =
  (userAgent: string): IO.IO<void> =>
  () =>
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [1],
      addRules: [
        {
          id: 1,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: "User-Agent",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: userAgent,
              },
            ],
          },
          condition: {
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
            ],
          },
        },
      ],
    });
