import { describe, expect, it } from "vitest";
import type { HbbTVVersion } from "./dae/capabilities";
import { type DeviceMedia, type DeviceProfile, EMULATOR_CAPABILITIES, EMULATOR_DEVICE } from "./device";
import { EMULATOR_TERMINAL, type HbbTVOption } from "./terminal";
import { deviceXmlCapabilities, uiProfileName } from "./xmlCapabilities";

const deviceOf = (
  hbbtvVersion: HbbTVVersion,
  capabilities: Partial<DeviceProfile["capabilities"]> = {},
  options: ReadonlyArray<HbbTVOption> = [],
): DeviceProfile => ({
  ...EMULATOR_DEVICE,
  terminal: { ...EMULATOR_TERMINAL, hbbtvVersion, options },
  capabilities: { ...EMULATOR_CAPABILITIES, uiProfiles: ["OITF_HD_UIPROF", "+DVB_S", "+TRICKMODE"], ...capabilities },
});

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, "text/xml");

/** The document without the whitespace between elements, serialized: equal when canonically equal. */
const normalized = (xml: string): string => {
  const document = parse(xml);
  const walker = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
  const blanks: Node[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.trim() === "") blanks.push(node);
  }
  for (const node of blanks) node.parentNode?.removeChild(node);
  return new XMLSerializer().serializeToString(document);
};

/** The base document of TS 102 796 §10.2.4.7, in the V1.4.1 and V1.7.1 text. */
const baseDocument = (namespace: string) => `
  <profilelist xmlns="${namespace}"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xsi:schemaLocation="${namespace} config-hbbtv-oitfCapabilities.xsd">
    <ui_profile name="OITF_HD_UIPROF+DVB_S+TRICKMODE">
    <ext>
      <parentalcontrol schemes="dvb-si">true</parentalcontrol>
      <clientMetadata type="dvb-si">true</clientMetadata>
      <temporalClipping />
    </ext>
    </ui_profile>
    <audio_profile name="MPEG1_L3" type="audio/mpeg"/>
    <audio_profile name="HEAAC" type="audio/mp4"/>
    <audio_profile name="MP4_HEAAC" type="audio/mp4" transport="dash" sync_tl="dash_pr"/>
    <video_profile name="MP4_AVC_SD_25_HEAAC" type="video/mp4" transport="dash" sync_tl="dash_pr" />
    <video_profile name="MP4_AVC_HD_25_HEAAC" type="video/mp4" transport="dash" sync_tl="dash_pr" />
    <video_profile name="MP4_AVC_SD_25_HEAAC_EBUTTD" type="video/mp4" transport="dash" sync_tl="dash_pr" />
    <video_profile name="MP4_AVC_HD_25_HEAAC_EBUTTD" type="video/mp4" transport="dash" sync_tl="dash_pr" />
    <video_profile name="TS_AVC_SD_25_HEAAC" type="video/mpeg" sync_tl="temi" />
    <video_profile name="TS_AVC_HD_25_HEAAC" type="video/mpeg" sync_tl="temi" />
    <video_profile name="MP4_AVC_SD_25_HEAAC" type="video/mp4" />
    <video_profile name="MP4_AVC_HD_25_HEAAC" type="video/mp4" />
    <html5_media>true</html5_media>
  </profilelist>`;

/** Each `<audio_profile>`/`<video_profile>` of a document, as `element name type transport sync_tl`. */
const profilesOf = (xml: string): string[] =>
  Array.from(parse(xml).documentElement.children)
    .filter((element) => element.localName === "audio_profile" || element.localName === "video_profile")
    .map((element) =>
      [
        element.localName,
        ...["name", "type", "transport", "sync_tl"].map((name) => element.getAttribute(name) ?? "-"),
      ].join(" "),
    );

const added = (version: HbbTVVersion, media: Partial<DeviceMedia>): string[] => {
  const base = profilesOf(deviceXmlCapabilities(deviceOf(version)));
  const all = profilesOf(
    deviceXmlCapabilities(deviceOf(version, { media: { ...EMULATOR_CAPABILITIES.media, ...media } })),
  );
  expect(all.slice(0, 3)).toEqual(base.slice(0, 3)); // the base level first
  const rest = [...all];
  for (const profile of base) rest.splice(rest.indexOf(profile), 1);
  return rest;
};

describe("xmlCapabilities of a device (TS 102 796 §10.2.4)", () => {
  it("is the base document of §10.2.4.7 for a terminal with only the base level of features", () => {
    expect(normalized(deviceXmlCapabilities(deviceOf("2.0.1")))).toBe(
      normalized(baseDocument("urn:hbbtv:config:oitf:oitfCapabilities:2014-1")),
    );
    for (const version of ["2.0.2", "2.0.3", "2.0.4"] as const) {
      expect(normalized(deviceXmlCapabilities(deviceOf(version)))).toBe(
        normalized(baseDocument("urn:hbbtv:config:oitf:oitfCapabilities:2017-1")),
      );
    }
  });

  it("has the HbbTV 1.5 document (V1.2.1) for HbbTV 1.5 and 1.0: no namespace, no timelines, no HTML5 media", () => {
    for (const version of ["1.5", "1.0"] as const) {
      const xml = deviceXmlCapabilities(deviceOf(version));
      const root = parse(xml).documentElement;

      expect([root.localName, root.namespaceURI, root.attributes.length]).toEqual(["profilelist", null, 0]);
      expect(root.getElementsByTagName("ext")[0]?.outerHTML).toBe(
        '<ext><parentalcontrol schemes="dvb-si">true</parentalcontrol><clientMetadata type="dvb-si">true</clientMetadata></ext>',
      );
      expect(root.getElementsByTagName("html5_media")).toHaveLength(0);
      expect(profilesOf(xml).sort()).toEqual(
        [
          "video_profile MP4_AVC_SD_25_HEAAC video/mp4 dash -",
          "video_profile MP4_AVC_HD_25_HEAAC video/mp4 dash -",
          "audio_profile MPEG1_L3 audio/mpeg - -",
          "audio_profile HEAAC audio/mp4 - -",
          "video_profile TS_AVC_SD_25_HEAAC video/mpeg - -",
          "video_profile TS_AVC_HD_25_HEAAC video/mpeg - -",
          "video_profile MP4_AVC_SD_25_HEAAC video/mp4 - -",
          "video_profile MP4_AVC_HD_25_HEAAC video/mp4 - -",
        ].sort(),
      );
    }
  });

  it("names the UI profile with its fragments and the terminal's option strings (§10.2.4.8)", () => {
    const device = deviceOf("2.0.1", { uiProfiles: ["+DVB_T", "OITF_FULL_HD_UIPROF", "+DL"] }, ["+DL", "+DRM"]);

    expect(uiProfileName(device)).toBe("OITF_FULL_HD_UIPROF+DVB_T+DL+DRM");
    expect(parse(deviceXmlCapabilities(device)).getElementsByTagName("ui_profile")[0]?.getAttribute("name")).toBe(
      "OITF_FULL_HD_UIPROF+DVB_T+DL+DRM",
    );
  });

  it("adds the E-AC3 profiles of §10.2.4.7 (Table 9)", () => {
    expect(added("2.0.1", { eac3: true }).sort()).toEqual(
      [
        "audio_profile MP4_E-AC3 audio/mp4 - -",
        "audio_profile MP4_E-AC3 audio/mp4 dash dash_pr",
        "video_profile TS_AVC_SD_25_E-AC3 video/mpeg - temi",
        "video_profile TS_AVC_HD_25_E-AC3 video/mpeg - temi",
        "video_profile MP4_AVC_SD_25_E-AC3 video/mp4 - -",
        "video_profile MP4_AVC_HD_25_E-AC3 video/mp4 - -",
        "video_profile MP4_AVC_SD_25_E-AC3 video/mp4 dash dash_pr",
        "video_profile MP4_AVC_HD_25_E-AC3 video/mp4 dash dash_pr",
        "video_profile MP4_AVC_SD_25_E-AC3_EBUTTD video/mp4 dash dash_pr",
        "video_profile MP4_AVC_HD_25_E-AC3_EBUTTD video/mp4 dash dash_pr",
      ].sort(),
    );
    expect(added("1.5", { eac3: true }).sort()).toEqual(
      [
        "video_profile TS_AVC_SD_25_E-AC3 video/mpeg - -",
        "video_profile TS_AVC_HD_25_E-AC3 video/mpeg - -",
        "video_profile MP4_AVC_SD_25_E-AC3 video/mp4 - -",
        "video_profile MP4_AVC_HD_25_E-AC3 video/mp4 - -",
        "video_profile MP4_AVC_SD_25_E-AC3 video/mp4 dash -",
        "video_profile MP4_AVC_HD_25_E-AC3 video/mp4 dash -",
      ].sort(),
    );
  });

  it("adds the HEVC profiles of §10.2.4.7, with E-AC3 when it has it (§7.3.1.3)", () => {
    expect(added("2.0.4", { hevcUhd: true, hevcHd: "10-bit" })).toEqual([
      "video_profile MP4_HEVC_UHD_25_HEAAC_EBUTTD video/mp4 dash dash_pr",
      "video_profile MP4_HEVC_UHD_25_HEAAC_EBUTTD video/mp4 - -",
      "video_profile MP4_HEVC_HD_25_10_HEAAC_EBUTTD video/mp4 dash dash_pr",
      "video_profile MP4_HEVC_HD_25_10_HEAAC_EBUTTD video/mp4 - -",
    ]);
    expect(added("2.0.4", { eac3: true, hevcHd: "8-bit" }).filter((profile) => profile.includes("HEVC"))).toEqual([
      "video_profile MP4_HEVC_HD_25_8_HEAAC_EBUTTD video/mp4 dash dash_pr",
      "video_profile MP4_HEVC_HD_25_8_HEAAC_EBUTTD video/mp4 - -",
      "video_profile MP4_HEVC_HD_25_8_E-AC3_EBUTTD video/mp4 dash dash_pr",
      "video_profile MP4_HEVC_HD_25_8_E-AC3_EBUTTD video/mp4 - -",
    ]);
    // HbbTV 1.5 has no HEVC.
    expect(added("1.5", { hevcUhd: true, hevcHd: "10-bit" })).toEqual([]);
  });

  it("ends with a <drm> element for each DRM system (OIPF DAE §9.3.10)", () => {
    const drm = [
      { systemId: "urn:dvb:casystemid:19188", formats: ["TS_PF", "MP4_PDCF"] },
      { systemId: "urn:dvb:casystemid:12345", formats: ["TS_PF"], protectionGateways: ["ci+"] },
      { systemId: 'urn:"odd"&<id>', formats: [] },
    ];
    const root = parse(deviceXmlCapabilities(deviceOf("2.0.1", { drm }))).documentElement;
    const last = Array.from(root.children).slice(-3);

    expect(last.map((element) => element.outerHTML)).toEqual([
      '<drm xmlns="urn:hbbtv:config:oitf:oitfCapabilities:2014-1" DRMSystemID="urn:dvb:casystemid:19188">TS_PF MP4_PDCF</drm>',
      '<drm xmlns="urn:hbbtv:config:oitf:oitfCapabilities:2014-1" DRMSystemID="urn:dvb:casystemid:12345" protectionGateways="ci+">TS_PF</drm>',
      '<drm xmlns="urn:hbbtv:config:oitf:oitfCapabilities:2014-1" DRMSystemID="urn:&quot;odd&quot;&amp;&lt;id&gt;"/>',
    ]);
    expect(last[2]?.getAttribute("DRMSystemID")).toBe('urn:"odd"&<id>');
    expect(root.getElementsByTagName("drm")).toHaveLength(3);
  });

  it("has no whitespace between elements, unless indented for people to read", () => {
    const device = deviceOf("2.0.1", { drm: [{ systemId: "urn:dvb:casystemid:19188", formats: [] }] });
    const compact = deviceXmlCapabilities(device);
    const indented = deviceXmlCapabilities(device, "  ");

    expect(compact).not.toMatch(/>\s+</);
    expect(parse(compact).documentElement.firstChild?.nodeName).toBe("ui_profile");
    expect(indented.split("\n")[1]).toBe('  <ui_profile name="OITF_HD_UIPROF+DVB_S+TRICKMODE">');
    expect(normalized(indented)).toBe(normalized(compact));
  });
});
