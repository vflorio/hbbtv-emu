import { createLogger, type OnStateChangeCallback, type Stateful } from "@hbb-emu/core";
import {
  type DeviceProfile,
  deviceHasCapability,
  deviceXmlCapabilities,
  type OIPF,
  type OipfCapabilitiesState,
} from "@hbb-emu/oipf-api";
import * as IO from "fp-ts/IO";

const logger = createLogger("OipfCapabilities");

export type OipfCapabilitiesEnv = Readonly<{
  /** The TV the page runs on, as the host configures it now. */
  device: IO.IO<DeviceProfile>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// OipfCapabilities Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `application/oipfCapabilities` (OIPF DAE §7.15.3): what the TV can do, which is the
 * device's (`DeviceProfile`), read when the application asks. The host's configuration
 * may come after the object (a page without the synchronous bootstrap): it answers for
 * the TV it is then.
 *
 * It has what a TV has: `xmlCapabilities` and `hasCapability()`. The emulator's own
 * `hbbtvVersion`, `uiProfiles`, `drmSystems` and `mediaFormats` are gone: an application
 * that relied on them would not find them on a TV.
 */
export class OipfCapabilities implements OIPF.DAE.Capabilities.Capabilities, Stateful<OipfCapabilitiesState> {
  readonly #device: IO.IO<DeviceProfile>;
  #document: { xml: string; document: Document } | null = null;

  constructor(env: OipfCapabilitiesEnv) {
    this.#device = env.device;
  }

  /**
   * The device's capability description (TS 102 796 §10.2.4), parsed as XML: its
   * `doctype` is `null` (§10.2.4.6). The same `Document` while the device's capabilities
   * stay the same; a new one when they change (§10.2.4.1: some "are dynamic").
   */
  get xmlCapabilities(): Document {
    const xml = deviceXmlCapabilities(this.#device());
    const parsed =
      this.#document?.xml === xml
        ? this.#document
        : { xml, document: new DOMParser().parseFromString(xml, "text/xml") };
    this.#document = parsed;
    return parsed.document;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Stateful Interface: the state is the device's, which only the host changes
  // ═══════════════════════════════════════════════════════════════════════════

  applyState = (_state: Partial<OipfCapabilitiesState>): IO.IO<void> => IO.of(undefined);

  getState: IO.IO<Partial<OipfCapabilitiesState>> = () => ({});

  subscribe = (_callback: OnStateChangeCallback<OipfCapabilitiesState>): IO.IO<() => void> => IO.of(() => {});

  notifyStateChange = (_changedKeys: ReadonlyArray<keyof OipfCapabilitiesState>): IO.IO<void> => IO.of(undefined);

  // ═══════════════════════════════════════════════════════════════════════════
  // Capabilities API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Whether the TV supports `profileName` (OIPF DAE §7.15.3.2): one of the terminal's HbbTV
   * option strings (TS 102 796 §10.2.4.8), or its base UI profile or one of its name
   * fragments (OIPF DAE §9.2). See `deviceHasCapability`.
   */
  hasCapability = (profileName: string): boolean => {
    const supported = deviceHasCapability(this.#device(), String(profileName));
    logger.debug("hasCapability:", profileName, supported)();
    return supported;
  };
}
