import { describe, expect, it } from "vitest";
import {
  type DeviceProfile,
  DeviceProfileCodec,
  deviceHasCapability,
  deviceUserAgent,
  EMULATOR_CAPABILITIES,
  EMULATOR_DEVICE,
} from "./device";
import { EMULATOR_TERMINAL, emulatorUserAgent, hbbtvUserAgent, TerminalIdentityCodec } from "./terminal";

describe("a device profile", () => {
  it("sends the User-Agent its identity gives (TS 102 796 §7.3.2.4)", () => {
    expect(deviceUserAgent(EMULATOR_DEVICE)).toBe(emulatorUserAgent());

    const sonic = { ...EMULATOR_TERMINAL, vendorName: "Sonic", modelName: "40VX700WDR", options: ["+DL" as const] };
    expect(deviceUserAgent({ ...EMULATOR_DEVICE, terminal: sonic })).toBe(hbbtvUserAgent(sonic));
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
    // A device of the version before capabilities: the background migrates it.
    expect(DeviceProfileCodec.is({ terminal: EMULATOR_TERMINAL })).toBe(false);
  });
});

describe("hasCapability() of its Capabilities object (OIPF DAE §7.15.3.2)", () => {
  const device: DeviceProfile = {
    ...EMULATOR_DEVICE,
    terminal: { ...EMULATOR_TERMINAL, options: ["+DL", "+DRM"] },
    capabilities: { ...EMULATOR_CAPABILITIES, uiProfiles: ["OITF_FULL_HD_UIPROF", "+DVB_S", "+TRICKMODE"] },
  };
  const has = (name: string) => deviceHasCapability(device, name);

  it("answers the HbbTV option strings with the terminal's (TS 102 796 §10.2.4.8, Annex A)", () => {
    expect([has("+DL"), has("+DRM"), has("+PVR"), has("+IPC"), has("+AFS")]).toEqual([true, true, false, false, false]);
    expect(deviceHasCapability(EMULATOR_DEVICE, "+DL")).toBe(false);
  });

  it("answers its base UI profile and name fragments (OIPF DAE §9.2)", () => {
    expect([has("OITF_FULL_HD_UIPROF"), has("+DVB_S"), has("+TRICKMODE")]).toEqual([true, true, true]);
    expect([has("OITF_HD_UIPROF"), has("+DVB_T"), has("+ITV_KEYS")]).toEqual([false, false, false]);
    expect(deviceHasCapability(EMULATOR_DEVICE, "OITF_HD_UIPROF")).toBe(true);
  });

  it("is false for what is no profile name: MIME types, codecs, DRM systems, object types", () => {
    for (const name of [
      "video/mp4",
      "application/dash+xml",
      "avc1",
      "urn:dvb:casystemid:19219",
      "video/broadcast",
      "",
      "+dl",
    ]) {
      expect(has(name ?? "")).toBe(false);
    }
  });
});
