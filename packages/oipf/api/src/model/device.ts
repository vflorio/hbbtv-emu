/**
 * A device profile: the TV the emulator is (ROADMAP 2.1). For now, what it says it is:
 * its identity, and the User-Agent header it sends. Capabilities, keyset, resolution and
 * known quirks will join it.
 */

import * as t from "io-ts";
import { EMULATOR_TERMINAL, hbbtvUserAgent, TerminalIdentityCodec } from "./terminal";

export const DeviceProfileCodec = t.readonly(
  t.intersection([
    t.type({
      terminal: TerminalIdentityCodec,
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

/** The emulator as itself: its own identity, and the header that identity gives. */
export const EMULATOR_DEVICE: DeviceProfile = { terminal: EMULATOR_TERMINAL };

/** The User-Agent header the device sends: its own if it has one, else the one its identity gives. */
export const deviceUserAgent = (device: DeviceProfile): string =>
  device.userAgent ? device.userAgent : hbbtvUserAgent(device.terminal);
