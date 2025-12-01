import type { ClassType, Keyset } from "@hbb-emu/lib";
import { compose } from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";

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
    RED = KEYSET_VALUES.RED;
    GREEN = KEYSET_VALUES.GREEN;
    YELLOW = KEYSET_VALUES.YELLOW;
    BLUE = KEYSET_VALUES.BLUE;
    NAVIGATION = KEYSET_VALUES.NAVIGATION;
    VCR = KEYSET_VALUES.VCR;
    SCROLL = KEYSET_VALUES.SCROLL;
    INFO = KEYSET_VALUES.INFO;
    NUMERIC = KEYSET_VALUES.NUMERIC;
    ALPHA = KEYSET_VALUES.ALPHA;
    OTHER = KEYSET_VALUES.OTHER;
  };

const WithKeysetValue = <T extends ClassType>(Base: T) =>
  class extends Base {
    private currentValueRef = IORef.newIORef<O.Option<number>>(O.none)();

    get value(): number | null {
      return pipe(this.currentValueRef.read(), O.toNullable);
    }

    setValue = (value: number): void => {
      this.currentValueRef.write(O.some(value));
    };
  };

const KeysetClass = compose(class {}, WithKeysetConstants, WithKeysetValue);

export const createKeyset = (): Keyset => new KeysetClass();
