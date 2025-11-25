import type { ClassType, Keyset } from "@hbb-emu/lib";
import { compose } from "@hbb-emu/lib";

const KEYSET_VALUES = {
  RED: 0x1,
  GREEN: 0x2,
  YELLOW: 0x4,
  BLUE: 0x8,
  NAVIGATION: 0x10,
  VCR: 0x20,
  SCROLL: 0x40,
  INFO: 0x80,
  NUMERIC: 0x100,
  ALPHA: 0x200,
  OTHER: 0x400,
} as const;

const WithKeysetConstants = <T extends ClassType>(Base: T) =>
  class extends Base {
    readonly RED = KEYSET_VALUES.RED;
    readonly GREEN = KEYSET_VALUES.GREEN;
    readonly YELLOW = KEYSET_VALUES.YELLOW;
    readonly BLUE = KEYSET_VALUES.BLUE;
    readonly NAVIGATION = KEYSET_VALUES.NAVIGATION;
    readonly VCR = KEYSET_VALUES.VCR;
    readonly SCROLL = KEYSET_VALUES.SCROLL;
    readonly INFO = KEYSET_VALUES.INFO;
    readonly NUMERIC = KEYSET_VALUES.NUMERIC;
    readonly ALPHA = KEYSET_VALUES.ALPHA;
    readonly OTHER = KEYSET_VALUES.OTHER;
  };

const WithKeysetValue = <T extends ClassType>(Base: T) =>
  class extends Base {
    private currentValue: number | null = null;

    get value(): number | null {
      return this.currentValue;
    }

    setValue = (value: number): void => {
      this.currentValue = value;
    };
  };

const KeysetClass = compose(class {}, WithKeysetConstants, WithKeysetValue);

export const createKeyset = (): Keyset => new KeysetClass();
