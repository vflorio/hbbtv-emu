/**
 * The terminal's identity: what it says it is in its HTTP User-Agent header
 * (TS 102 796 §7.3.2.4). The first part of a device profile (ROADMAP 2.1).
 *
 * Every request made on behalf of an application carries:
 *
 *   HbbTV/1.7.1 (<capabilities>; <vendorName>; <modelName>; <softwareVersion>; [<hardwareVersion>]; <familyName>; <reserved>)
 *
 * - the version token is the edition of TS 102 796 that defines the terminal's HbbTV
 *   version (`HBBTV_VERSION_MAP`): HbbTV 2.0.1 is `HbbTV/1.4.1`;
 * - `<capabilities>` is zero or more option strings (§10.2.4.8, Table 13), concatenated;
 * - `<familyName>` exists from V1.4.1 (HbbTV 2.0.1) on, and is globally unique: a reverse
 *   domain name prefix or a version 4 UUID. V1.2.1 (HbbTV 1.5) and before have no such
 *   field. V1.3.1 (HbbTV 2.0) was withdrawn: the emulator gives it the field too;
 * - `<reserved>` is empty;
 * - the header "may be extended with other implementation-specific information [...] In
 *   particular, it is recommended to include the browser user agent information": the
 *   browser's part comes first, as on TVs (the companion screen example of §14.7.3.2).
 */

import {
  DEFAULT_HBBTV_VERSION,
  HBBTV_VERSION_MAP,
  type HbbTVVersion,
  isHbbTVVersion,
  specVersionOf,
} from "./dae/capabilities";

/** HbbTV option strings (TS 102 796 §10.2.4.8, Table 13). */
export const HBBTV_OPTIONS = ["+DL", "+PVR", "+DRM", "+IPC", "+AFS"] as const;

export type HbbTVOption = (typeof HBBTV_OPTIONS)[number];

export type TerminalIdentity = Readonly<{
  hbbtvVersion: HbbTVVersion;
  /** The options the terminal supports. */
  options: ReadonlyArray<HbbTVOption>;
  /** The consumer-facing make or brand. */
  vendorName: string;
  /** The consumer-facing model name. */
  modelName: string;
  softwareVersion: string;
  /** Optional: empty when the terminal gives none. */
  hardwareVersion?: string;
  /** Globally unique (HbbTV 2.0.1 on; ignored before). */
  familyName: string;
  /** The browser's user agent, before the HbbTV part; none when empty. */
  browser?: string;
}>;

/** Whether the version's User-Agent has a `<familyName>`: from TS 102 796 V1.3.1 (HbbTV 2.0) on. */
const hasFamilyName = (version: HbbTVVersion): boolean =>
  HBBTV_VERSION_MAP.findIndex((entry) => entry.hbbtv === version) <=
  HBBTV_VERSION_MAP.findIndex((entry) => entry.hbbtv === "2.0");

/** The User-Agent header of a terminal (TS 102 796 §7.3.2.4). */
export const hbbtvUserAgent = (terminal: TerminalIdentity): string => {
  const fields = [
    terminal.options.join(""),
    terminal.vendorName,
    terminal.modelName,
    terminal.softwareVersion,
    terminal.hardwareVersion ?? "",
    ...(hasFamilyName(terminal.hbbtvVersion) ? [terminal.familyName] : []),
    "",
  ];
  const hbbtv = `HbbTV/${specVersionOf(terminal.hbbtvVersion)} (${fields.join("; ")})`;
  return terminal.browser ? `${terminal.browser} ${hbbtv}` : hbbtv;
};

/**
 * The emulator's own identity, which says what it is rather than imitating a TV:
 * - no options: it has neither download, nor PVR, nor a DRM agent, nor a CICAM;
 * - its family is a version 4 UUID of its own;
 * - its browser part is only `Mozilla/5.0`, which applications look for, and no engine:
 *   the one it runs on is not the TV's.
 */
export const EMULATOR_TERMINAL: TerminalIdentity = {
  hbbtvVersion: DEFAULT_HBBTV_VERSION,
  options: [],
  vendorName: "hbbtv-emu",
  modelName: "Emulator",
  softwareVersion: "0.1.0",
  familyName: "3f1c6d2e-8b4a-4e7f-9c35-2a6b8d0e5f41",
  browser: "Mozilla/5.0",
};

/** The emulator's User-Agent, for an HbbTV version (one it does not know: its own). */
export const emulatorUserAgent = (hbbtvVersion: string = EMULATOR_TERMINAL.hbbtvVersion): string =>
  hbbtvUserAgent({
    ...EMULATOR_TERMINAL,
    hbbtvVersion: isHbbTVVersion(hbbtvVersion) ? hbbtvVersion : EMULATOR_TERMINAL.hbbtvVersion,
  });
