/**
 * `xmlCapabilities` of the application/oipfCapabilities object (OIPF DAE §7.15.3.1,
 * TS 102 796 §10.2.4): the device's capabilities as an XML document, whose root element is
 * `<profilelist>` (the schema of TS 102 796 A.2.15, which replaces OIPF DAE Annex F).
 *
 * The document is the one TS 102 796 gives for "a terminal supporting only the base level
 * of features", in the edition of the device's HbbTV version, with what the device adds:
 * - the `ui_profile` name is the device's UI profile and its HbbTV option strings
 *   (§10.2.4.8: "In the ui_profile element's name property");
 * - the profiles of the optional media (E-AC3, HEVC HD, HEVC UHD) that §10.2.4.7 lists;
 * - a `<drm>` element for each DRM system, at the end (OIPF DAE §9.3.10).
 *
 * By edition:
 * - V1.2.1 (HbbTV 1.5) has no namespace, no `sync_tl`, no `<html5_media>`, no
 *   `<temporalClipping>`, no HEVC. Its example puts `<clientMetadata>` after `<ui_profile>`
 *   and repeats two `<audio_profile>`: the emulator follows the schema, where it is an
 *   element of `<ext>` ("Valid values for HbbTV 1.5"), and lists each profile once.
 *   V1.1.1 (HbbTV 1.0) gives no document: the emulator gives it the one of HbbTV 1.5.
 * - V1.3.1 and V1.4.1 (HbbTV 2.0, 2.0.1): the namespace `…:2014-1`.
 * - V1.5.1 (HbbTV 2.0.2) on: `…:2017-1`, with the same base document.
 *
 * Choices of the emulator, which the spec allows (§10.2.4.3: the order of the profiles in
 * their group "may vary"): every `<audio_profile>`, then every `<video_profile>`, base
 * level first, as the schema groups them, and not after `<html5_media>` as the spec's
 * "added after the elements listed" would put the E-AC3 ones. V1.4.1 writes
 * `MP4_HEVC_UHD_25_E-AC3 EBUTTD`, with a space (which would make two names, OIPF DAE
 * §9.3.11): it is `_EBUTTD`, as later editions write it. The document has no whitespace
 * between elements, so that an application's `firstChild` is an element.
 *
 * Not yet: `<broadcast>`, `<video_display_format>` (which a UHD terminal shall include),
 * `<display_size>`, `<audio_system>`, `<graphicsPerformance>`, HDR, HFR, NGA.
 */

import type { HbbTVVersion } from "./dae/capabilities";
import { isBaseUiProfile } from "./dae/capabilities";
import type { DeviceMedia, DeviceProfile, DrmSystem } from "./device";

/** The XML namespace of the capabilities of an HbbTV version (§10.2.4.5); none before 2.0. */
export const xmlCapabilitiesNamespace = (version: HbbTVVersion): string | null => {
  switch (version) {
    case "1.0":
    case "1.5":
      return null;
    case "2.0":
    case "2.0.1":
      return "urn:hbbtv:config:oitf:oitfCapabilities:2014-1";
    default:
      return "urn:hbbtv:config:oitf:oitfCapabilities:2017-1";
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Elements
// ─────────────────────────────────────────────────────────────────────────────

type XmlElement = Readonly<{
  name: string;
  attributes?: ReadonlyArray<readonly [string, string | undefined]>;
  children?: ReadonlyArray<XmlElement>;
  text?: string;
}>;

const escapeXml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const serialize = (element: XmlElement, indent: string, depth: number): string => {
  const pad = indent ? `\n${indent.repeat(depth)}` : "";
  const attributes = (element.attributes ?? [])
    .filter((attribute): attribute is readonly [string, string] => attribute[1] !== undefined)
    .map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
    .join("");
  const open = `${pad}<${element.name}${attributes}`;
  if (element.children && element.children.length > 0) {
    const children = element.children.map((child) => serialize(child, indent, depth + 1)).join("");
    return `${open}>${children}${pad}</${element.name}>`;
  }
  return element.text !== undefined ? `${open}>${escapeXml(element.text)}</${element.name}>` : `${open}/>`;
};

/** An `<audio_profile>` or `<video_profile>` (OIPF DAE §9.3.11), with `sync_tl` (Table 12a). */
type Profile = Readonly<{ name: string; type: string; transport?: "dash"; syncTl?: "dash_pr" | "temi" }>;

type Profiles = Readonly<{ audio: ReadonlyArray<Profile>; video: ReadonlyArray<Profile> }>;

const profileElement =
  (element: "audio_profile" | "video_profile") =>
  (profile: Profile): XmlElement => ({
    name: element,
    attributes: [
      ["name", profile.name],
      ["type", profile.type],
      ["transport", profile.transport],
      ["sync_tl", profile.syncTl],
    ],
  });

const drmElement = (drm: DrmSystem): XmlElement => ({
  name: "drm",
  attributes: [
    ["DRMSystemID", drm.systemId],
    ["protectionGateways", drm.protectionGateways?.length ? drm.protectionGateways.join(" ") : undefined],
  ],
  text: drm.formats.join(" "),
});

// ─────────────────────────────────────────────────────────────────────────────
// Profiles, by edition
// ─────────────────────────────────────────────────────────────────────────────

const MP4 = "video/mp4";
const TS = "video/mpeg";

/** The profiles a terminal lists when it supports the medium. */
const when = (supported: boolean, listed: ReadonlyArray<Profile>): ReadonlyArray<Profile> => (supported ? listed : []);

/** HbbTV 1.0 and 1.5 (V1.2.1): no timelines, no EBU-TT-D, no HEVC. */
const legacyProfiles = (eac3: boolean): Profiles => {
  const video = (audio: string): ReadonlyArray<Profile> => [
    { name: `MP4_AVC_SD_25_${audio}`, type: MP4, transport: "dash" },
    { name: `MP4_AVC_HD_25_${audio}`, type: MP4, transport: "dash" },
    { name: `TS_AVC_SD_25_${audio}`, type: TS },
    { name: `TS_AVC_HD_25_${audio}`, type: TS },
    { name: `MP4_AVC_SD_25_${audio}`, type: MP4 },
    { name: `MP4_AVC_HD_25_${audio}`, type: MP4 },
  ];
  return {
    audio: [
      { name: "MPEG1_L3", type: "audio/mpeg" },
      { name: "HEAAC", type: "audio/mp4" },
    ],
    video: [...video("HEAAC"), ...when(eac3, video("E-AC3"))],
  };
};

/** HbbTV 2.0 on (V1.4.1 and later). */
const profiles = (media: DeviceMedia): Profiles => {
  const dash = { type: MP4, transport: "dash", syncTl: "dash_pr" } as const;
  const hevc = (label: string): ReadonlyArray<Profile> =>
    (media.eac3 ? ["HEAAC", "E-AC3"] : ["HEAAC"]).flatMap((audio) => [
      { name: `MP4_${label}_${audio}_EBUTTD`, ...dash },
      { name: `MP4_${label}_${audio}_EBUTTD`, type: MP4 },
    ]);
  const hevcHd = media.hevcHd === "8-bit" ? "HEVC_HD_25_8" : media.hevcHd === "10-bit" ? "HEVC_HD_25_10" : null;
  return {
    audio: [
      { name: "MPEG1_L3", type: "audio/mpeg" },
      { name: "HEAAC", type: "audio/mp4" },
      { name: "MP4_HEAAC", type: "audio/mp4", transport: "dash", syncTl: "dash_pr" },
      ...when(media.eac3, [
        { name: "MP4_E-AC3", type: "audio/mp4" },
        { name: "MP4_E-AC3", type: "audio/mp4", transport: "dash", syncTl: "dash_pr" },
      ]),
    ],
    video: [
      { name: "MP4_AVC_SD_25_HEAAC", ...dash },
      { name: "MP4_AVC_HD_25_HEAAC", ...dash },
      { name: "MP4_AVC_SD_25_HEAAC_EBUTTD", ...dash },
      { name: "MP4_AVC_HD_25_HEAAC_EBUTTD", ...dash },
      { name: "TS_AVC_SD_25_HEAAC", type: TS, syncTl: "temi" },
      { name: "TS_AVC_HD_25_HEAAC", type: TS, syncTl: "temi" },
      { name: "MP4_AVC_SD_25_HEAAC", type: MP4 },
      { name: "MP4_AVC_HD_25_HEAAC", type: MP4 },
      ...when(media.eac3, [
        { name: "TS_AVC_SD_25_E-AC3", type: TS, syncTl: "temi" },
        { name: "TS_AVC_HD_25_E-AC3", type: TS, syncTl: "temi" },
        { name: "MP4_AVC_SD_25_E-AC3", type: MP4 },
        { name: "MP4_AVC_HD_25_E-AC3", type: MP4 },
        { name: "MP4_AVC_SD_25_E-AC3", ...dash },
        { name: "MP4_AVC_HD_25_E-AC3", ...dash },
        { name: "MP4_AVC_SD_25_E-AC3_EBUTTD", ...dash },
        { name: "MP4_AVC_HD_25_E-AC3_EBUTTD", ...dash },
      ]),
      ...when(media.hevcUhd, hevc("HEVC_UHD_25")),
      ...(hevcHd ? hevc(hevcHd) : []),
    ],
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The `name` of `<ui_profile>`: the base profile, its name fragments, then the terminal's
 * option strings that are not among them, e.g. `OITF_HD_UIPROF+DVB_S+TRICKMODE+DL`.
 */
export const uiProfileName = (device: DeviceProfile): string => {
  const { uiProfiles } = device.capabilities;
  const fragments = [
    ...uiProfiles.filter(isBaseUiProfile),
    ...uiProfiles.filter((name) => !isBaseUiProfile(name)),
    ...device.terminal.options,
  ];
  return fragments.filter((name, index) => fragments.indexOf(name) === index).join("");
};

/**
 * The XML of the device's `xmlCapabilities`. With an `indent`, one element per line, for
 * people to read; without, none of the whitespace an application would find between them.
 */
export const deviceXmlCapabilities = (device: DeviceProfile, indent = ""): string => {
  const version = device.terminal.hbbtvVersion;
  const namespace = xmlCapabilitiesNamespace(version);
  const { media, drm } = device.capabilities;
  const legacy = namespace === null;
  const { audio, video } = legacy ? legacyProfiles(media.eac3) : profiles(media);
  const ext: XmlElement[] = [
    { name: "parentalcontrol", attributes: [["schemes", "dvb-si"]], text: "true" },
    { name: "clientMetadata", attributes: [["type", "dvb-si"]], text: "true" },
    ...(legacy ? [] : [{ name: "temporalClipping" }]),
  ];
  const root: XmlElement = {
    name: "profilelist",
    attributes: namespace
      ? [
          ["xmlns", namespace],
          ["xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance"],
          ["xsi:schemaLocation", `${namespace} config-hbbtv-oitfCapabilities.xsd`],
        ]
      : [],
    children: [
      { name: "ui_profile", attributes: [["name", uiProfileName(device)]], children: [{ name: "ext", children: ext }] },
      ...audio.map(profileElement("audio_profile")),
      ...video.map(profileElement("video_profile")),
      ...(legacy ? [] : [{ name: "html5_media", text: "true" }]),
      ...drm.map(drmElement),
    ],
  };
  return serialize(root, indent, 0).replace(/^\n/, "");
};
