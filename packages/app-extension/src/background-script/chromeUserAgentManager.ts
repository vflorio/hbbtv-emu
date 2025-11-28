import { type ClassType, createLogger } from "@hbb-emu/lib";
import * as IO from "fp-ts/IO";

const logger = createLogger("Chrome User Agent Manager");

export interface UserAgentManager {
  updateUserAgent: (userAgent: string) => IO.IO<void>;
}

export const WithChromeUserAgentManager = <T extends ClassType>(Base: T) =>
  class extends Base implements UserAgentManager {
    updateUserAgent = (userAgent: string) =>
      IO.of(() => {
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
        logger.log("User-Agent updated to:", userAgent);
      });
  };
