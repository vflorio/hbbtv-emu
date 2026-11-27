import { describe, expect, it } from "vitest";
import { CLIENT_HINT_HEADERS, USER_AGENT_RULE_ID, userAgentRule, withUserAgent } from "./userAgent";

const TV = "Mozilla/5.0 HbbTV/1.4.1 (; Sonic; VX600WDR; 1.14.0; ; dd5528b6-d0a9-40a8-acdb-21fa2eabeb2e; )";

describe("the TV's user agent over HTTP", () => {
  it("MV3: one session rule sets it on every request and removes the browser's client hints", () => {
    const rule = userAgentRule(TV);

    expect(rule.id).toBe(USER_AGENT_RULE_ID);
    expect(rule.condition.urlFilter).toBe("|http");
    expect(rule.condition.resourceTypes).toContain("main_frame");
    expect(rule.action.requestHeaders).toEqual([
      { header: "User-Agent", operation: "set", value: TV },
      ...CLIENT_HINT_HEADERS.map((header) => ({ header, operation: "remove" })),
    ]);
  });

  it("covers the hints Chromium sends by default and those a server asks for", () => {
    expect(CLIENT_HINT_HEADERS).toEqual(
      expect.arrayContaining(["Sec-CH-UA", "Sec-CH-UA-Mobile", "Sec-CH-UA-Platform", "Sec-CH-UA-Full-Version-List"]),
    );
  });

  it("MV2: replaces the browser's user agent and drops every client hint, whatever its case", () => {
    const headers = withUserAgent(
      [
        { name: "Accept", value: "*/*" },
        { name: "user-agent", value: "Mozilla/5.0 (X11; Linux x86_64) Chrome/155.0.0.0" },
        { name: "sec-ch-ua", value: '"Chromium";v="155"' },
        { name: "Sec-CH-UA-Platform", value: '"Linux"' },
        { name: "Sec-Fetch-Mode", value: "navigate" },
      ],
      TV,
    );

    expect(headers).toEqual([
      { name: "Accept", value: "*/*" },
      { name: "Sec-Fetch-Mode", value: "navigate" },
      { name: "User-Agent", value: TV },
    ]);
  });
});
