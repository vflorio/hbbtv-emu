import { describe, expect, it } from "vitest";
import { hideUserAgentData, initializeUserAgent } from "./userAgent";

const TV = "Mozilla/5.0 HbbTV/1.4.1 (; Sonic; VX600WDR; 1.14.0; ; dd5528b6-d0a9-40a8-acdb-21fa2eabeb2e; )";

/** A navigator as Chromium has it: `userAgentData` an accessor of the prototype. */
const chromiumNavigator = () => {
  class FakeNavigator {}
  Object.defineProperty(FakeNavigator.prototype, "userAgentData", {
    get: () => ({ brands: [{ brand: "Chromium", version: "155" }], mobile: false, platform: "Linux" }),
    configurable: true,
    enumerable: true,
  });
  return new FakeNavigator() as { userAgentData?: unknown };
};

describe("the TV's user agent in the page", () => {
  it("takes the browser's client hints away: the navigator has no userAgentData at all", () => {
    const navigator = chromiumNavigator();
    expect("userAgentData" in navigator).toBe(true);

    hideUserAgentData(navigator);

    expect("userAgentData" in navigator).toBe(false);
    expect(navigator.userAgentData).toBeUndefined();
    // Again (every new configuration applies the user agent again): nothing left to take.
    hideUserAgentData(navigator);
  });

  it("applies the configured user agent, its appVersion, and no client hints", () => {
    const applied: string[] = [];

    initializeUserAgent({
      getUserAgent: () => TV,
      getHbbTVVersion: () => undefined,
      defaultHbbTVVersion: "2.0.1",
      setUserAgent: (userAgent) => () => void applied.push(`userAgent ${userAgent}`),
      setAppVersion: (appVersion) => () => void applied.push(`appVersion ${appVersion}`),
      hideUserAgentData: () => void applied.push("no userAgentData"),
    })();

    expect(applied).toEqual([`userAgent ${TV}`, `appVersion ${TV.replace("Mozilla/", "")}`, "no userAgentData"]);
  });
});
