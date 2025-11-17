export interface Keyset {
  RED: number;
  GREEN: number;
  YELLOW: number;
  BLUE: number;
  NAVIGATION: number;
  VCR: number;
  SCROLL: number;
  INFO: number;
  NUMERIC: number;
  ALPHA: number;
  OTHER: number;
  value: number | null;
  setValue: (value: number) => void;
}

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

export const createKeyset = (): Keyset => {
  let currentValue: number | null = null;

  return {
    ...KEYSET_VALUES,
    get value() {
      return currentValue;
    },
    setValue(value: number) {
      currentValue = value;
    },
  };
};
