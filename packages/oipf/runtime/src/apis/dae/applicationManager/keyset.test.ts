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

  it("offers the keys of HbbTV Table 12: colours, navigation, VCR, digits", () => {
    const keyset = createKeyset();

    expect(keyset.maximumValue).toBe(
      keyset.RED | keyset.GREEN | keyset.YELLOW | keyset.BLUE | keyset.NAVIGATION | keyset.VCR | keyset.NUMERIC,
    );
  });

  it("setValue() discards the keys not available to applications, and processes the rest", () => {
    const keyset = createKeyset();

    const delivered = keyset.setValue(keyset.RED | keyset.SCROLL | keyset.INFO | keyset.ALPHA | keyset.OTHER);

    expect(delivered).toBe(keyset.RED);
    expect(keyset.value).toBe(keyset.RED);
  });

  it("an initial value holds only available keys too", () => {
    expect(createKeyset(0x1 | 0x80).value).toBe(0x1);
  });

  it("has no key icons, and assumes no pointer support until the application says so", () => {
    const keyset = createKeyset();

    expect(keyset.getKeyIcon(403)).toBeNull();
    expect(keyset.supportsPointer).toBe(false);
    keyset.supportsPointer = true;
    expect(keyset.supportsPointer).toBe(true);
  });

  it("value is read-only", () => {
    const keyset = createKeyset(0x1) as { value: number };

    expect(() => {
      keyset.value = 0xff;
    }).toThrow(TypeError);
  });
});
