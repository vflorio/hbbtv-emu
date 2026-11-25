import { describe, expect, it } from "vitest";
import { hexToText, isValidHex, textToHex } from "./hex";

describe("hex", () => {
  it("encodes text as uppercase hex bytes", () => {
    expect(textToHex("AB")).toBe("4142");
  });

  it("round-trips UTF-8 text (stream event payloads are often non-ASCII)", () => {
    const text = "Pubblicità → 30s";
    expect(hexToText(textToHex(text))).toBe(text);
  });

  it("ignores whitespace when decoding", () => {
    expect(hexToText("41 42\n43")).toBe("ABC");
  });

  it("returns an empty string for invalid hex instead of throwing", () => {
    expect(hexToText("XYZ1")).toBe("");
    expect(hexToText("414")).toBe("");
  });

  it.each([
    ["", true],
    ["4142", true],
    ["41 42", true],
    ["414", false],
    ["zz", false],
  ])("isValidHex(%j) → %s", (input, expected) => {
    expect(isValidHex(input)).toBe(expected);
  });
});
