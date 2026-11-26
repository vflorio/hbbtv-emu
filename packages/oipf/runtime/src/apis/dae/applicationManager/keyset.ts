import { OIPF } from "@hbb-emu/oipf-api";

const { RED, GREEN, YELLOW, BLUE, NAVIGATION, VCR, NUMERIC } = OIPF.DAE.ApplicationManager.KeysetMask;

/**
 * The key events available to applications: those with a key code in HbbTV
 * TS 102 796 §10.2.2.1 Table 12 (colours, arrows, OK, BACK, digits, play/pause/stop,
 * fast forward/rewind). The terminal handles every other key (P+/P-, volume, INFO,
 * page up/down…) and does not deliver it. No VK_RECORD: the emulator has no PVR.
 */
export const MAXIMUM_KEYSET_VALUE = RED | GREEN | YELLOW | BLUE | NAVIGATION | VCR | NUMERIC;

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

  #value: number;

  constructor(initialValue = 0) {
    this.#value = initialValue & MAXIMUM_KEYSET_VALUE;
  }

  get value(): number {
    return this.#value;
  }

  get maximumValue(): number {
    return MAXIMUM_KEYSET_VALUE;
  }

  /**
   * The part of the request for keys not available to the application is discarded,
   * the rest is processed (TS 102 796 §10.2.2.1); the result is what will be
   * delivered. `otherKeys` only matters for VK_RECORD, which is not available.
   */
  setValue = (value: number, _otherKeys?: ReadonlyArray<number>): number => {
    this.#value = value & MAXIMUM_KEYSET_VALUE;
    return this.#value;
  };

  /** The emulated remote has no key icons. */
  getKeyIcon = (_code: number): string | null => null;
}

export const createKeyset = (initialValue = 0): OIPF.DAE.ApplicationManager.Keyset => new Keyset(initialValue);
