/**
 * OIPF Capabilities State
 *
 * State for application/oipfCapabilities object.
 * Represents device capabilities like supported codecs, DRM systems,
 * and UI profiles.
 */

import * as t from "io-ts";
import type { DAE } from "../../specification";

// ─────────────────────────────────────────────────────────────────────────────
// OIPF Capabilities State
// ─────────────────────────────────────────────────────────────────────────────

export const OipfCapabilitiesStateCodec = t.partial({
  /** HbbTV version supported (e.g., "2.0.1") */
  hbbtvVersion: t.string,

  /** UI profile identifiers */
  uiProfiles: t.array(t.string),

  /** Supported DRM system URNs */
  drmSystems: t.array(t.string),

  /** Supported media formats */
  mediaFormats: t.array(
    t.partial({
      /** Container MIME type (e.g., "video/mp4") */
      container: t.string,
      videoCodecs: t.array(t.string),
      audioCodecs: t.array(t.string),
      subtitleFormats: t.array(t.string),
    }),
  ),
});

export type OipfCapabilitiesState = t.TypeOf<typeof OipfCapabilitiesStateCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Version Mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The HbbTV versions, newest first, with the edition of ETSI TS 102 796 that defines each:
 * the version a terminal's User-Agent names (`HbbTV/1.4.1` is HbbTV 2.0.1, §7.3.2.4). Not
 * OIPF DAE versions, which HbbTV references (OIPF DAE R1 v1.1, R2 v2.1, v2.3).
 */
export const HBBTV_VERSION_MAP = [
  { spec: "1.7.1", hbbtv: "2.0.4" },
  { spec: "1.6.1", hbbtv: "2.0.3" },
  { spec: "1.5.1", hbbtv: "2.0.2" },
  { spec: "1.4.1", hbbtv: "2.0.1" },
  { spec: "1.3.1", hbbtv: "2.0" },
  { spec: "1.2.1", hbbtv: "1.5" },
  { spec: "1.1.1", hbbtv: "1.0" },
] as const;

export type HbbTVVersion = (typeof HBBTV_VERSION_MAP)[number]["hbbtv"];
export type HbbTVSpecVersion = (typeof HBBTV_VERSION_MAP)[number]["spec"];

export const isHbbTVVersion = (version: string): version is HbbTVVersion =>
  HBBTV_VERSION_MAP.some((entry) => entry.hbbtv === version);

/** The edition of TS 102 796 that defines an HbbTV version. */
export const specVersionOf = (hbbtvVersion: HbbTVVersion): HbbTVSpecVersion =>
  (HBBTV_VERSION_MAP.find((entry) => entry.hbbtv === hbbtvVersion) as (typeof HBBTV_VERSION_MAP)[number]).spec;

// ─────────────────────────────────────────────────────────────────────────────
// Default Values
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_HBBTV_VERSION: HbbTVVersion = "2.0.1";

/** The base UI profiles of OIPF DAE §9.2 (Table 15): a terminal supports at least one. */
export const BASE_UI_PROFILES = [
  "OITF_SDEU_UIPROF",
  "OITF_SD60_UIPROF",
  "OITF_SDUS_UIPROF",
  "OITF_HD_UIPROF",
  "OITF_FULL_HD_UIPROF",
] as const;

export const isBaseUiProfile = (name: string): boolean => (BASE_UI_PROFILES as ReadonlyArray<string>).includes(name);

/**
 * The UI profile: a base profile, then the name fragments of what the terminal adds to it
 * (OIPF DAE §9.2, Table 16). The one of TS 102 796 §10.2.4.7 is HD (`OITF_HD_UIPROF`).
 */
export const DEFAULT_UI_PROFILES: NonNullable<DAE.Capabilities.Capabilities["uiProfiles"]> = [
  "OITF_HD_UIPROF",
  "+TRICKMODE",
  "+DVB_T",
  "+DVB_T2",
  "+DVB_C",
  "+DVB_C2",
  "+DVB_S",
  "+DVB_S2",
];

export const DEFAULT_DRM_SYSTEMS: NonNullable<DAE.Capabilities.Capabilities["drmSystems"]> = [
  "urn:dvb:casystemid:19219" /* Widevine */,
];

export const DEFAULT_MEDIA_FORMATS: NonNullable<DAE.Capabilities.Capabilities["mediaFormats"]> = [
  {
    container: "video/mp4",
    videoCodecs: ["avc1", "avc3", "hev1", "hvc1"],
    audioCodecs: ["mp4a.40.2", "mp4a.40.5", "ac-3", "ec-3"],
    subtitleFormats: ["application/ttml+xml"],
  },
  {
    container: "video/webm",
    videoCodecs: ["vp8", "vp9"],
    audioCodecs: ["vorbis", "opus"],
    subtitleFormats: [],
  },
  {
    container: "application/dash+xml",
    videoCodecs: ["avc1", "avc3", "hev1", "hvc1"],
    audioCodecs: ["mp4a.40.2", "mp4a.40.5", "ac-3", "ec-3"],
    subtitleFormats: ["application/ttml+xml"],
  },
];
