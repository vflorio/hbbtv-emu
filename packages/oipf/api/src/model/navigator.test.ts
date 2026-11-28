import { describe, expect, it } from "vitest";
import { DeviceProfileCodec, deviceNavigator, EMULATOR_DEVICE } from "./device";
import { engineOfUserAgent, navigatorProperties } from "./navigator";
import { emulatorUserAgent } from "./terminal";

/** User-Agents shaped like those of TV browsers, one per engine (the HbbTV part left out). */
const TIZEN_2_4 =
  "Mozilla/5.0 (SMART-TV; Linux; Tizen 2.4.0) AppleWebkit/538.1 (KHTML, like Gecko) SamsungBrowser/1.1 TV Safari/538.1";
const WEBKIT =
  "Mozilla/5.0 (DirectFB; Linux armv7l) AppleWebKit/534.26+ (KHTML, like Gecko) Version/5.0 Safari/534.26+";
const WEBOS =
  "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36";
const TIZEN_5 =
  "Mozilla/5.0 (SMART-TV; LINUX; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 TV Safari/537.36";
const FIREFOX_OS = "Mozilla/5.0 (FreeBSD; Viera; rv:34.0) Gecko/20100101 Firefox/34.0";

describe("the engine a User-Agent names", () => {
  it("is Blink with Chrome/, Gecko with its Gecko/ token, WebKit with AppleWebKit/", () => {
    expect(engineOfUserAgent(WEBOS)).toBe("blink");
    expect(engineOfUserAgent(FIREFOX_OS)).toBe("gecko");
    // WebKit's "like Gecko" is no Gecko; Tizen 2 writes AppleWebkit.
    expect(engineOfUserAgent(WEBKIT)).toBe("webkit");
    expect(engineOfUserAgent(TIZEN_2_4)).toBe("webkit");
  });

  it("is none when the User-Agent names none, as the emulator's", () => {
    expect(engineOfUserAgent(emulatorUserAgent())).toBeUndefined();
  });

  it("is a guess: Tizen 5 runs Blink, its User-Agent says WebKit", () => {
    expect(engineOfUserAgent(TIZEN_5)).toBe("webkit");
    expect(navigatorProperties(TIZEN_5, { engine: "blink" }).vendor).toBe("Google Inc.");
  });
});

describe("the TV's navigator", () => {
  it("has the TV's User-Agent, as appVersion too", () => {
    expect(navigatorProperties(WEBOS)).toMatchObject({ userAgent: WEBOS, appVersion: WEBOS.slice("Mozilla/".length) });
  });

  it("has the vendor and productSub of the TV's engine, and Gecko's properties only with Gecko", () => {
    expect(navigatorProperties(WEBOS)).toMatchObject({
      vendor: "Google Inc.",
      productSub: "20030107",
      oscpu: null,
      buildID: null,
    });
    expect(navigatorProperties(WEBKIT)).toMatchObject({
      vendor: "Apple Computer, Inc.",
      productSub: "20030107",
      oscpu: null,
      buildID: null,
    });
    const gecko = navigatorProperties(FIREFOX_OS);
    expect(gecko).toMatchObject({ vendor: "", productSub: "20100101" });
    expect(gecko).not.toHaveProperty("oscpu");
    expect(gecko).not.toHaveProperty("buildID");
  });

  it("leaves the engine's properties to the browser when no engine is known", () => {
    const properties = navigatorProperties(emulatorUserAgent());
    for (const property of ["vendor", "productSub", "oscpu", "buildID", "platform", "hardwareConcurrency"]) {
      expect(properties).not.toHaveProperty(property);
    }
  });

  it("has the machine the device says: its platform (Gecko's oscpu too) and its cores, or none", () => {
    expect(navigatorProperties(WEBOS, { platform: "Linux armv7l", hardwareConcurrency: 4 })).toMatchObject({
      platform: "Linux armv7l",
      oscpu: null,
      hardwareConcurrency: 4,
    });
    expect(navigatorProperties(FIREFOX_OS, { platform: "Linux armv7l" })).toMatchObject({
      platform: "Linux armv7l",
      oscpu: "Linux armv7l",
    });
    expect(navigatorProperties(TIZEN_2_4, { hardwareConcurrency: null })).toMatchObject({
      hardwareConcurrency: null,
    });
  });

  it("never has the client hints: neither userAgentData nor deviceMemory", () => {
    for (const userAgent of [emulatorUserAgent(), WEBOS, WEBKIT, FIREFOX_OS]) {
      expect(navigatorProperties(userAgent)).toMatchObject({ userAgentData: null, deviceMemory: null });
    }
  });

  it("is the device's: its User-Agent and what it says beyond it", () => {
    const device = { ...EMULATOR_DEVICE, userAgent: WEBOS, navigator: { platform: "Linux aarch64" } };

    expect(deviceNavigator(device)).toEqual(navigatorProperties(WEBOS, { platform: "Linux aarch64" }));
    expect(DeviceProfileCodec.is(JSON.parse(JSON.stringify(device)))).toBe(true);
    expect(DeviceProfileCodec.is({ ...EMULATOR_DEVICE, navigator: { hardwareConcurrency: null } })).toBe(true);
    expect(DeviceProfileCodec.is({ ...EMULATOR_DEVICE, navigator: { engine: "presto" } })).toBe(false);
  });
});
