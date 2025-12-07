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
