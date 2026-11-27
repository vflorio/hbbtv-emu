import { describe, expect, it } from "vitest";
import { channelTimeMs, livePosition } from "./channelClock";

describe("channelClock", () => {
  it("counts the channel's time from the Unix epoch", () => {
    expect(channelTimeMs(1_800_000_000_000)).toBe(1_800_000_000_000);
  });

  it("places a looping stream where it has got to since the channel's time started", () => {
    // 1 000 000 s since the epoch, a 3 s loop: 333 333 loops and 1 s.
    expect(livePosition(1_000_000_000, 3)).toBeCloseTo(1);
    expect(livePosition(1_000_000_500, 3)).toBeCloseTo(1.5);
  });

  it("is the same wherever and whenever it is asked: two pages at the same time agree", () => {
    const now = 1_764_000_123_456;
    expect(livePosition(now, 634.56)).toBe(livePosition(now, 634.56));
    // Ten seconds later, ten seconds further on.
    expect((livePosition(now + 10_000, 634.56) as number) - (livePosition(now, 634.56) as number)).toBeCloseTo(10);
  });

  it("has no position for a stream without a finite duration (a live one follows the real time on its own)", () => {
    expect(livePosition(1_000_000_000, Number.POSITIVE_INFINITY)).toBeNull();
    expect(livePosition(1_000_000_000, Number.NaN)).toBeNull();
    expect(livePosition(1_000_000_000, 0)).toBeNull();
  });
});
