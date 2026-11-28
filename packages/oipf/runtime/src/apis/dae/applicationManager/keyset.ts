import { type DeviceKeys, OIPF } from "@hbb-emu/oipf-api";

const { RED, GREEN, YELLOW, BLUE, NAVIGATION, VCR, NUMERIC } = OIPF.DAE.ApplicationManager.KeysetMask;

/**
 * The key events available to applications: those with a key code in HbbTV
 * TS 102 796 §10.2.2.1 Table 12 (colours, arrows, OK, BACK, digits, play/pause/stop,
 * fast forward/rewind). The terminal handles every other key (P+/P-, volume, INFO,
 * page up/down…) and does not deliver it. No VK_RECORD: the emulator has no PVR.
 */
export const MAXIMUM_KEYSET_VALUE = RED | GREEN | YELLOW | BLUE | NAVIGATION | VCR | NUMERIC;

/**
 * The keys a TV makes available to applications (`maximumValue`): those of Table 12,
 * and the groups beyond it its remote gives too (a quirk of the device).
 */
export const keysetMaximum = (keys: DeviceKeys): number =>
  keys.extra.reduce((maximum, group) => maximum | OIPF.DAE.ApplicationManager.KeysetMask[group], MAXIMUM_KEYSET_VALUE);

/**
 * The keys "only available to applications once activated" (Table 12): the digits and
 * the VCR keys. The others are always available. (Annex O.7 makes the VCR keys always
 * available to a DVB-I linked application controlling media: the emulator has no DVB-I.)
 */
export const ACTIVATION_KEYS = VCR | NUMERIC;

/** The keys available to an application now, of the TV's `maximum` (TS 102 796 §10.2.2.1). */
export const availableKeys = (maximum: number, activated: boolean): number =>
  activated ? maximum : maximum & ~ACTIVATION_KEYS;

/** Which keys the application may have: the TV's, and those available to it now. */
export type KeysetAvailability = Readonly<{
  /** The keys the TV makes available to applications (`maximumValue`). */
  maximum: () => number;
  /** Those available to the application now (`availableKeys`). */
  available: () => number;
}>;

/** A TV that follows the spec, and an application that does not depend on activation. */
const ALWAYS_AVAILABLE: KeysetAvailability = {
  maximum: () => MAXIMUM_KEYSET_VALUE,
  available: () => MAXIMUM_KEYSET_VALUE,
};

/** OIPF DAE §7.2.5 Keyset: the remote-control keys the application receives. */
export class Keyset implements OIPF.DAE.ApplicationManager.Keyset {
  readonly RED = 0x1;
  readonly GREEN = 0x2;
  readonly YELLOW = 0x4;
  readonly BLUE = 0x8;
  readonly NAVIGATION = 0x10;
  readonly VCR = 0x20;
  readonly SCROLL = 0x40;
  readonly INFO = 0x80;
  readonly NUMERIC = 0x100;
  readonly ALPHA = 0x200;
  readonly OTHER = 0x400;

  /** OIPF DAE §7.2.5.2: the application sets it; the OITF assumes `false` otherwise. */
  supportsPointer = false;

  readonly #availability: KeysetAvailability;

  /** What the application asked for last, before the unavailable keys were discarded. */
  #requested: number;

  #value: number;

  constructor(initialValue = 0, availability: KeysetAvailability = ALWAYS_AVAILABLE) {
    this.#availability = availability;
    this.#requested = initialValue;
    this.#value = initialValue & availability.available();
  }

  get value(): number {
    return this.#value;
  }

  get maximumValue(): number {
    return this.#availability.maximum();
  }

  /**
   * The part of the request for keys not available to the application at that time is
   * discarded, the rest is processed (TS 102 796 §10.2.2.1); the result is what will be
   * delivered. `otherKeys` only matters for VK_RECORD, which is not available.
   */
  setValue = (value: number, _otherKeys?: ReadonlyArray<number>): number => {
    this.#requested = value;
    this.#value = value & this.#availability.available();
    return this.#value;
  };

  /**
   * The application's last request again, against the keys available now. Not for the
   * activation itself, which leaves the keyset as it is (§10.2.2.1: the application calls
   * `setValue()` again): for the emulator's guess about it at start, when the TV says
   * otherwise (see `Activation`).
   */
  reapply = (): number => {
    this.#value = this.#requested & this.#availability.available();
    return this.#value;
  };

  /** The emulated remote has no key icons. */
  getKeyIcon = (_code: number): string | null => null;
}

export const createKeyset = (initialValue = 0, availability: KeysetAvailability = ALWAYS_AVAILABLE): Keyset =>
  new Keyset(initialValue, availability);
