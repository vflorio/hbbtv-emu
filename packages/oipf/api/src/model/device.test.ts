import { describe, expect, it } from "vitest";
import { DeviceProfileCodec, deviceUserAgent, EMULATOR_DEVICE } from "./device";
import { EMULATOR_TERMINAL, emulatorUserAgent, hbbtvUserAgent, TerminalIdentityCodec } from "./terminal";

describe("a device profile", () => {
  it("sends the User-Agent its identity gives (TS 102 796 §7.3.2.4)", () => {
    expect(deviceUserAgent(EMULATOR_DEVICE)).toBe(emulatorUserAgent());

    const sonic = { ...EMULATOR_TERMINAL, vendorName: "Sonic", modelName: "40VX700WDR", options: ["+DL" as const] };
    expect(deviceUserAgent({ terminal: sonic })).toBe(hbbtvUserAgent(sonic));
  });

  it("sends its own header verbatim, when it has one: a TV that does not follow the spec", () => {
    const userAgent = "Mozilla/5.0 (SmartTV; HbbTV/1.5.1 (+DL;Vendor/ModelName;0.0.1;0.0.1;) CE-HTML/1.0";

    expect(deviceUserAgent({ ...EMULATOR_DEVICE, userAgent })).toBe(userAgent);
    expect(deviceUserAgent({ ...EMULATOR_DEVICE, userAgent: "" })).toBe(emulatorUserAgent());
  });

  it("is plain data: what storage and messages carry back is a profile", () => {
    const stored = JSON.parse(JSON.stringify({ ...EMULATOR_DEVICE, userAgent: "TV/1.0" }));

    expect(DeviceProfileCodec.is(stored)).toBe(true);
    expect(DeviceProfileCodec.is(JSON.parse(JSON.stringify(EMULATOR_DEVICE)))).toBe(true);
  });

  it("knows only the HbbTV versions and option strings of the spec", () => {
    expect(TerminalIdentityCodec.is({ ...EMULATOR_TERMINAL, hbbtvVersion: "9.9" })).toBe(false);
    expect(TerminalIdentityCodec.is({ ...EMULATOR_TERMINAL, options: ["+DL", "+4K"] })).toBe(false);
    expect(DeviceProfileCodec.is({ userAgent: "TV/1.0" })).toBe(false);
  });
});
