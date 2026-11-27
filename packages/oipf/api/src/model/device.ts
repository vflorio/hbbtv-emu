/**
 * A device profile: the TV the emulator is (ROADMAP 2.1). What it says it is (its
 * identity, and the User-Agent header it sends) and what it can do (its capabilities).
 * Keyset, resolution and known quirks will join it.
 */

import * as t from "io-ts";
import { DEFAULT_DRM_SYSTEMS, DEFAULT_MEDIA_FORMATS, DEFAULT_UI_PROFILES } from "./dae/capabilities";
import { EMULATOR_TERMINAL, hbbtvUserAgent, TerminalIdentityCodec } from "./terminal";

/** What the TV can do, as its `application/oipfCapabilities` object reports it. */
export const DeviceCapabilitiesCodec = t.readonly(
  t.type({
    /**
     * The UI profile: a base profile name and the name fragments of what the terminal adds
     * to it (OIPF DAE §9.2, Tables 15 and 16), e.g. `OITF_HD_UIPROF`, `+DVB_S`, `+TRICKMODE`.
     * The HbbTV option strings are the terminal's (`terminal.options`).
     */
    uiProfiles: t.readonlyArray(t.string),
    /** The DRM systems, by DVB CA system id URN. */
    drmSystems: t.readonlyArray(t.string),
    /** The media formats, by container. */
    mediaFormats: t.readonlyArray(
      t.partial({
        container: t.string,
        videoCodecs: t.array(t.string),
        audioCodecs: t.array(t.string),
        subtitleFormats: t.array(t.string),
      }),
    ),
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

export const EMULATOR_CAPABILITIES: DeviceCapabilities = {
  uiProfiles: DEFAULT_UI_PROFILES,
  drmSystems: DEFAULT_DRM_SYSTEMS,
  mediaFormats: DEFAULT_MEDIA_FORMATS,
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
 * applications find those in `xmlCapabilities`.
 */
export const deviceHasCapability = (device: DeviceProfile, profileName: string): boolean =>
  (device.terminal.options as ReadonlyArray<string>).includes(profileName) ||
  device.capabilities.uiProfiles.includes(profileName);
