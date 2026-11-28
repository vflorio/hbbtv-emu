import { navigatorProperties } from "@hbb-emu/oipf-api";
import { describe, expect, it } from "vitest";
import { initializeUserAgent, navigatorOverride } from "./userAgent";

const TV = "Mozilla/5.0 HbbTV/1.4.1 (; Sonic; VX600WDR; 1.14.0; ; dd5528b6-d0a9-40a8-acdb-21fa2eabeb2e; )";
const WEBOS =
  "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36";
const WEBKIT =
  "Mozilla/5.0 (DirectFB; Linux armv7l) AppleWebKit/534.26+ (KHTML, like Gecko) Version/5.0 Safari/534.26+";

type FakeNavigator = Record<string, unknown>;

/** A navigator as the browser has it: every property an accessor of its prototype. */
const browserNavigator = (properties: Record<string, unknown>): FakeNavigator => {
  class Navigator {}
  for (const [name, value] of Object.entries(properties)) {
    Object.defineProperty(Navigator.prototype, name, { get: () => value, configurable: true, enumerable: true });
  }
  return new Navigator() as FakeNavigator;
};

/** Chromium on a Linux desktop, in a secure context. */
const chromium = () =>
  browserNavigator({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
    appVersion: "5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
    vendor: "Google Inc.",
    productSub: "20030107",
    platform: "Linux x86_64",
    hardwareConcurrency: 16,
    deviceMemory: 8,
    userAgentData: { brands: [{ brand: "Chromium", version: "155" }], mobile: false, platform: "Linux" },
  });

/** Firefox on a Linux desktop. */
const firefox = () =>
  browserNavigator({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
    appVersion: "5.0 (X11)",
    vendor: "",
    productSub: "20100101",
    platform: "Linux x86_64",
    oscpu: "Linux x86_64",
    buildID: "20181001000000",
    hardwareConcurrency: 16,
  });

describe("the TV's navigator in the page", () => {
  it("is the TV's on the Chromium the emulator runs in: its engine and machine, no client hints", () => {
    const navigator = chromium();

    navigatorOverride(navigator)(
      navigatorProperties(WEBKIT, { platform: "Linux armv7l", hardwareConcurrency: null }),
    )();

    expect(navigator).toMatchObject({
      userAgent: WEBKIT,
      appVersion: WEBKIT.replace("Mozilla/", ""),
      vendor: "Apple Computer, Inc.",
      productSub: "20030107",
      platform: "Linux armv7l",
    });
    for (const absent of ["hardwareConcurrency", "deviceMemory", "userAgentData"]) {
      expect(absent in navigator).toBe(false);
    }
  });

  it("is the TV's on Firefox: no Gecko properties for a TV of another engine", () => {
    const navigator = firefox();

    navigatorOverride(navigator)(navigatorProperties(WEBOS, { platform: "Linux armv7l", hardwareConcurrency: 4 }))();

    expect(navigator).toMatchObject({ vendor: "Google Inc.", productSub: "20030107", hardwareConcurrency: 4 });
    expect("oscpu" in navigator).toBe(false);
    expect("buildID" in navigator).toBe(false);
  });

  it("leaves the browser what the TV does not say", () => {
    const navigator = chromium();

    navigatorOverride(navigator)(navigatorProperties(TV))();

    expect(navigator).toMatchObject({
      userAgent: TV,
      vendor: "Google Inc.",
      platform: "Linux x86_64",
      hardwareConcurrency: 16,
    });
    expect("userAgentData" in navigator).toBe(false);
  });

  it("gives the browser's properties back when a later configuration leaves them to it", () => {
    const navigator = firefox();
    const apply = navigatorOverride(navigator);

    apply(navigatorProperties(WEBOS, { platform: "Linux armv7l", hardwareConcurrency: null }))();
    // Again, the same: nothing left to take.
    apply(navigatorProperties(WEBOS, { platform: "Linux armv7l", hardwareConcurrency: null }))();
    expect(["oscpu" in navigator, "hardwareConcurrency" in navigator]).toEqual([false, false]);

    apply(navigatorProperties(TV))();

    expect(navigator).toMatchObject({
      userAgent: TV,
      vendor: "",
      platform: "Linux x86_64",
      oscpu: "Linux x86_64",
      buildID: "20181001000000",
      hardwareConcurrency: 16,
    });
  });

  it("applies the configured user agent with what the device says of its browser", () => {
    const applied: unknown[] = [];

    initializeUserAgent({
      getUserAgent: () => WEBOS,
      getHbbTVVersion: () => undefined,
      defaultHbbTVVersion: "2.0.1",
      getNavigator: () => ({ platform: "Linux aarch64" }),
      applyNavigator: (properties) => () => void applied.push(properties),
    })();

    expect(applied).toEqual([navigatorProperties(WEBOS, { platform: "Linux aarch64" })]);
  });
});
