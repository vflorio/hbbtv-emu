import type { OIPF } from "@hbb-emu/oipf";

export class Keyset implements OIPF.DAE.ApplicationManager.Keyset {
  currentValue: number;

  constructor(initialValue = 0) {
    this.currentValue = initialValue;
  }

  setValue = (mask: number): void => {
    this.currentValue = mask;
  };

  getValue = (): number => this.currentValue;

  setKey = (keyCode: number, enabled: boolean): void => {
    if (enabled) {
      this.currentValue |= keyCode;
    } else {
      this.currentValue &= ~keyCode;
    }
  };
}

export const createKeyset = (initialValue = 0): OIPF.DAE.ApplicationManager.Keyset => new Keyset(initialValue);
