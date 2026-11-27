/**
 * A device profile: the TV the emulator is (ROADMAP 2.1). What it says it is (its
 * identity, and the User-Agent header it sends) and what it can do (its capabilities).
 * Keyset, resolution and known quirks will join it.
 */

import * as t from "io-ts";
import { DEFAULT_UI_PROFILES } from "./dae/capabilities";
import { EMULATOR_TERMINAL, hbbtvUserAgent, TerminalIdentityCodec } from "./terminal";

/** HEVC HD video (TS 102 796 §7.3.1.3): none, 8-bit only, or 10-bit (which includes 8-bit). */
export const HEVC_HD_SUPPORT = ["none", "8-bit", "10-bit"] as const;

export type HevcHdSupport = (typeof HEVC_HD_SUPPORT)[number];

/**
 * The broadband media a terminal supports beyond the base level, as TS 102 796 §10.2.4.7
 * lists them: each adds its audio and video profiles to `xmlCapabilities`.
 */
export const DeviceMediaCodec = t.readonly(
  t.type({
    /**
     * E-AC3 audio (Table 9). The emulator has one broadcast and one broadband: the HEVC
     * profiles with E-AC3, which ask for it "in the broadcast channel", follow it too.
     */
    eac3: t.boolean,
    /** HEVC HD video: a terminal lists at most one of `HEVC_HD_25_8` and `HEVC_HD_25_10`. */
    hevcHd: t.keyof({ none: null, "8-bit": null, "10-bit": null }),
    /** HEVC UHD video (Table 9a). */
    hevcUhd: t.boolean,
  }),
);

export type DeviceMedia = t.TypeOf<typeof DeviceMediaCodec>;

/** A DRM system the terminal supports: a `<drm>` element (OIPF DAE §9.3.10, TS 102 796 §10.2.4.7). */
export const DrmSystemCodec = t.readonly(
  t.intersection([
    t.type({
      /** Its DVB CA system id, e.g. `urn:dvb:casystemid:19188` (Marlin). */
      systemId: t.string,
      /**
       * The protected formats, each a system layer and a protection format, e.g. `TS_PF`,
       * `MP4_PDCF`: the element's content. May be none.
       */
      formats: t.readonlyArray(t.string),
    }),
    t.partial({
      /** The CSP gateways that support it: `ci+` for a CA system of a CICAM, `dtcp-ip`. */
      protectionGateways: t.readonlyArray(t.string),
    }),
  ]),
);

export type DrmSystem = t.TypeOf<typeof DrmSystemCodec>;

/** What the TV can do, as its `application/oipfCapabilities` object reports it. */
export const DeviceCapabilitiesCodec = t.readonly(
  t.type({
    /**
     * The UI profile: a base profile name and the name fragments of what the terminal adds
     * to it (OIPF DAE §9.2, Tables 15 and 16), e.g. `OITF_HD_UIPROF`, `+DVB_S`, `+TRICKMODE`.
     * The HbbTV option strings are the terminal's (`terminal.options`).
     */
    uiProfiles: t.readonlyArray(t.string),
    media: DeviceMediaCodec,
    drm: t.readonlyArray(DrmSystemCodec),
  }),
);

export type DeviceCapabilities = t.TypeOf<typeof DeviceCapabilitiesCodec>;

export const DeviceProfileCodec = t.readonly(
  t.intersection([
    t.type({
      terminal: TerminalIdentityCodec,
      capabilities: DeviceCapabilitiesCodec,
    }),
    t.partial({
      /**
       * The User-Agent header as the TV sends it, verbatim, in place of the one its
       * identity gives (TS 102 796 §7.3.2.4): a quirk of the TVs whose header does not
       * follow the spec, which applications may look for. None when empty.
       */
      userAgent: t.string,
    }),
  ]),
);

export type DeviceProfile = t.TypeOf<typeof DeviceProfileCodec>;

/** Only the base level of media. */
export const BASE_MEDIA: DeviceMedia = { eac3: false, hevcHd: "none", hevcUhd: false };

/**
 * The emulator's capabilities: the base level of media, and no DRM system, because it has
 * no DRM agent (nor the `+DRM` option).
 */
export const EMULATOR_CAPABILITIES: DeviceCapabilities = {
  uiProfiles: DEFAULT_UI_PROFILES,
  media: BASE_MEDIA,
  drm: [],
};

/** The emulator as itself: its own identity, the header that identity gives, its capabilities. */
export const EMULATOR_DEVICE: DeviceProfile = { terminal: EMULATOR_TERMINAL, capabilities: EMULATOR_CAPABILITIES };

/** The User-Agent header the device sends: its own if it has one, else the one its identity gives. */
export const deviceUserAgent = (device: DeviceProfile): string =>
  device.userAgent ? device.userAgent : hbbtvUserAgent(device.terminal);

/**
 * `hasCapability(profileName)` of its Capabilities object (OIPF DAE §7.15.3.2): whether the
 * name is one of the terminal's HbbTV option strings (TS 102 796 §10.2.4.8, which Annex A
 * makes the profile names of the method), or its base UI profile or one of its name
 * fragments (OIPF DAE §9.2). Anything else, a MIME type or a codec, is no profile name:
 * applications find those in `xmlCapabilities` (`deviceXmlCapabilities`).
 */
export const deviceHasCapability = (device: DeviceProfile, profileName: string): boolean =>
  (device.terminal.options as ReadonlyArray<string>).includes(profileName) ||
  device.capabilities.uiProfiles.includes(profileName);
