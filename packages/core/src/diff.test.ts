import * as O from "fp-ts/Option";
import { describe, expect, it } from "vitest";
import { diffPatch } from "./diff";

describe("diffPatch", () => {
  it("is none when nothing changed", () => {
    expect(diffPatch({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 2] } })).toEqual(O.none);
  });

  it("keeps only the changed keys, recursively", () => {
    const before = { videoBroadcast: { volume: 100, muted: false }, keyset: { value: 0 } };
    const after = { videoBroadcast: { volume: 30, muted: false }, keyset: { value: 0 } };

    expect(diffPatch(before, after)).toEqual(O.some({ videoBroadcast: { volume: 30 } }));
  });

  it("replaces arrays as a whole", () => {
    expect(diffPatch({ list: [1, 2, 3] }, { list: [1, 2] })).toEqual(O.some({ list: [1, 2] }));
  });

  it("includes keys added in `after`", () => {
    expect(diffPatch({ a: 1 }, { a: 1, b: 2 })).toEqual(O.some({ b: 2 }));
  });

  it("never deletes keys missing from `after`", () => {
    expect(diffPatch({ a: 1, b: 2 }, { a: 1 })).toEqual(O.none);
  });

  it("replaces a value whose type changed", () => {
    expect(diffPatch({ current: null }, { current: { id: "ch1" } })).toEqual(O.some({ current: { id: "ch1" } }));
    expect(diffPatch({ current: { id: "ch1" } }, { current: null })).toEqual(O.some({ current: null }));
  });

  it("compares primitives at the top level", () => {
    expect(diffPatch(1, 1)).toEqual(O.none);
    expect(diffPatch(1, 2)).toEqual(O.some(2));
  });
});
