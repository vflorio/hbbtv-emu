import type { OIPF } from "@hbb-emu/oipf";
import { DEFAULT_KEYSET } from "../../../../oipf/dist/model";

export class Keyset implements OIPF.DAE.ApplicationManager.Keyset {
  currentValue = DEFAULT_KEYSET.value ?? 0;

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

export const createKeyset = (): OIPF.DAE.ApplicationManager.Keyset => new Keyset();
