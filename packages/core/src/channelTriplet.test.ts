import * as O from "fp-ts/Option";
import { describe, expect, it } from "vitest";
import { matchesChannelTriplet, toChannelTriplet } from "./channelTriplet";

describe("toChannelTriplet", () => {
  it("builds a triplet when onid, tsid and sid are all numbers", () => {
    expect(toChannelTriplet({ onid: 318, tsid: 5, sid: 52 })).toEqual(O.some({ onid: 318, tsid: 5, sid: 52 }));
  });

  it("drops unrelated fields", () => {
    const input = { onid: 1, tsid: 2, sid: 3, name: "DMAX" } as const;
    expect(toChannelTriplet(input)).toEqual(O.some({ onid: 1, tsid: 2, sid: 3 }));
  });

  it.each([
    [{ tsid: 2, sid: 3 }],
    [{ onid: "1", tsid: 2, sid: 3 }],
    [{ onid: 1, tsid: null, sid: 3 }],
    [{}],
  ])("is none when a field is missing or not a number: %j", (input) => {
    expect(toChannelTriplet(input)).toEqual(O.none);
  });
});

describe("matchesChannelTriplet", () => {
  const dmax = { onid: 318, tsid: 5, sid: 52 };

  it("matches the same triplet", () => {
    expect(matchesChannelTriplet(dmax)({ ...dmax })).toBe(true);
  });

  it("does not match when any component differs", () => {
    expect(matchesChannelTriplet(dmax)({ ...dmax, sid: 56 })).toBe(false);
    expect(matchesChannelTriplet(dmax)({ ...dmax, tsid: 6 })).toBe(false);
    expect(matchesChannelTriplet(dmax)({ ...dmax, onid: 1 })).toBe(false);
  });
});
