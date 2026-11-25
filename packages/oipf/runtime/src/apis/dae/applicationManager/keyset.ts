import type { OIPF } from "@hbb-emu/oipf-api";

/** OIPF DAE Keyset: the remote-control keys the application wants to receive. */
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

  #value: number;

  constructor(initialValue = 0) {
    this.#value = initialValue;
  }

  get value(): number {
    return this.#value;
  }

  setValue = (value: number, _otherKeys?: ReadonlyArray<number>): void => {
    this.#value = value;
  };
}

export const createKeyset = (initialValue = 0): OIPF.DAE.ApplicationManager.Keyset => new Keyset(initialValue);
