import { describe, expect, it } from "vitest";
import { createKeyset } from "./keyset";

describe("Keyset", () => {
  it("exposes the OIPF key group constants", () => {
    const keyset = createKeyset();

    expect([keyset.RED, keyset.GREEN, keyset.YELLOW, keyset.BLUE, keyset.NAVIGATION]).toEqual([
      0x1, 0x2, 0x4, 0x8, 0x10,
    ]);
    expect([keyset.VCR, keyset.SCROLL, keyset.INFO, keyset.NUMERIC, keyset.ALPHA, keyset.OTHER]).toEqual([
      0x20, 0x40, 0x80, 0x100, 0x200, 0x400,
    ]);
  });

  it("starts from the initial value", () => {
    expect(createKeyset().value).toBe(0);
    expect(createKeyset(0x10).value).toBe(0x10);
  });

  it("setValue() is reflected by value, as applications read it", () => {
    const keyset = createKeyset();

    keyset.setValue(keyset.RED | keyset.GREEN | keyset.NAVIGATION);

    expect(keyset.value).toBe(0x13);
  });

  it("setValue() returns the keyset that will be delivered", () => {
    const keyset = createKeyset();

    expect(keyset.setValue(keyset.RED | keyset.VCR)).toBe(0x21);
  });

  it("value is read-only", () => {
    const keyset = createKeyset(0x1) as { value: number };

    expect(() => {
      keyset.value = 0xff;
    }).toThrow(TypeError);
  });
});
