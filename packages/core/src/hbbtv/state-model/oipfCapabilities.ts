/**
 * OIPF Capabilities State
 *
 * State for application/oipfCapabilities object.
 * Represents device capabilities like supported codecs, DRM systems,
 * and UI profiles.
 */

import * as t from "io-ts";
import type { OIPF } from "../api";

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
 * Mapping between OIPF DAE version and HbbTV version.
 */
export const HBBTV_VERSION_MAP = [
  { oipf: "1.7.1", hbbtv: "2.0.4" },
  { oipf: "1.6.1", hbbtv: "2.0.3" },
  { oipf: "1.5.1", hbbtv: "2.0.2" },
  { oipf: "1.4.1", hbbtv: "2.0.1" },
  { oipf: "1.3.1", hbbtv: "2.0" },
  { oipf: "1.2.1", hbbtv: "1.5" },
  { oipf: "1.1.1", hbbtv: "1.0" },
] as const;

export type HbbTVVersion = (typeof HBBTV_VERSION_MAP)[number]["hbbtv"];
export type OIPFVersion = (typeof HBBTV_VERSION_MAP)[number]["oipf"];

/**
 * Get OIPF DAE version from HbbTV version.
 */
export const getOipfVersion = (hbbtvVersion: string): string | undefined =>
  HBBTV_VERSION_MAP.find((v) => v.hbbtv === hbbtvVersion)?.oipf;

/**
 * Get HbbTV version from OIPF DAE version.
 */
export const getHbbtvVersion = (oipfVersion: string): string | undefined =>
  HBBTV_VERSION_MAP.find((v) => v.oipf === oipfVersion)?.hbbtv;

/**
 * Build default User-Agent string for a given HbbTV version.
 */
export const buildDefaultUserAgent = (hbbtvVersion: string): string => {
  const oipfVersion = getOipfVersion(hbbtvVersion) ?? "1.4.1";
  return `Mozilla/5.0 (SmartTV; HbbTV/${oipfVersion} (+DL;Vendor/ModelName;0.0.1;0.0.1;) CE-HTML/1.0 NETRANGEMMH`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Default Values
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_HBBTV_VERSION = "2.0.1";

export const DEFAULT_UI_PROFILES: NonNullable<OIPF.Capabilities.Capabilities["uiProfiles"]> = [
  "+TRICKMODE",
  "+DVB_T",
  "+DVB_T2",
  "+DVB_C",
  "+DVB_C2",
  "+DVB_S",
  "+DVB_S2",
];

export const DEFAULT_DRM_SYSTEMS: NonNullable<OIPF.Capabilities.Capabilities["drmSystems"]> = [
  "urn:dvb:casystemid:19219" /* Widevine */,
];

export const DEFAULT_MEDIA_FORMATS: NonNullable<OIPF.Capabilities.Capabilities["mediaFormats"]> = [
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

export const DEFAULT_OIPF_CAPABILITIES: NonNullable<OipfCapabilitiesState> = {
  hbbtvVersion: DEFAULT_HBBTV_VERSION,
  uiProfiles: DEFAULT_UI_PROFILES,
  drmSystems: DEFAULT_DRM_SYSTEMS,
  mediaFormats: DEFAULT_MEDIA_FORMATS,
};
