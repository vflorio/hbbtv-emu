import { describe, expect, it } from "vitest";
import { specVersionOf } from "./dae/capabilities";
import { EMULATOR_TERMINAL, emulatorUserAgent, hbbtvUserAgent, type TerminalIdentity } from "./terminal";

const sonic: TerminalIdentity = {
  hbbtvVersion: "2.0.4",
  options: ["+PVR", "+DL"],
  vendorName: "Sonic",
  modelName: "40VX700WDR",
  softwareVersion: "1.32.455",
  hardwareVersion: "2.002",
  familyName: "com.example.2016VX700",
};

describe("the terminal's User-Agent (TS 102 796 §7.3.2.4)", () => {
  it("is the version of TS 102 796 that defines its HbbTV version", () => {
    expect(specVersionOf("1.0")).toBe("1.1.1");
    expect(specVersionOf("1.5")).toBe("1.2.1");
    expect(specVersionOf("2.0.1")).toBe("1.4.1");
    expect(specVersionOf("2.0.4")).toBe("1.7.1");
  });

  it("writes the fields of V1.7.1: the spec's first example", () => {
    expect(hbbtvUserAgent(sonic)).toBe(
      "HbbTV/1.7.1 (+PVR+DL; Sonic; 40VX700WDR; 1.32.455; 2.002; com.example.2016VX700; )",
    );
  });

  it("leaves an absent hardware version empty, and puts the browser's part first: the companion screen example", () => {
    const vx600: TerminalIdentity = {
      ...sonic,
      options: [],
      modelName: "VX600WDR",
      softwareVersion: "1.14.0",
      hardwareVersion: undefined,
      familyName: "dd5528b6-d0a9-40a8-acdb-21fa2eabeb2e",
      browser:
        "Mozilla/5.0 (Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.153 Safari/537.36 OPR/22.0.1481.0 OMI/4.2.12.34.ALSAN3.16",
    };

    expect(hbbtvUserAgent(vx600)).toBe(
      "Mozilla/5.0 (Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.153 Safari/537.36 OPR/22.0.1481.0 OMI/4.2.12.34.ALSAN3.16 HbbTV/1.7.1 (; Sonic; VX600WDR; 1.14.0; ; dd5528b6-d0a9-40a8-acdb-21fa2eabeb2e; )",
    );
  });

  it("has no familyName before HbbTV 2.0 (V1.2.1)", () => {
    expect(hbbtvUserAgent({ ...sonic, hbbtvVersion: "1.5", modelName: "TV44" })).toBe(
      "HbbTV/1.2.1 (+PVR+DL; Sonic; TV44; 1.32.455; 2.002; )",
    );
  });

  it("the emulator says what it is: no options it does not have, a family of its own, no engine", () => {
    expect(emulatorUserAgent()).toBe(
      `Mozilla/5.0 HbbTV/1.4.1 (; hbbtv-emu; Emulator; 0.1.0; ; ${EMULATOR_TERMINAL.familyName}; )`,
    );
    expect(EMULATOR_TERMINAL.familyName).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(emulatorUserAgent("2.0.4")).toContain("HbbTV/1.7.1 (");
    // A version it does not know: its own.
    expect(emulatorUserAgent("9.9")).toBe(emulatorUserAgent());
  });
});
