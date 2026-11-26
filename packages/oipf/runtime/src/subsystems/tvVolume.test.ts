import { describe, expect, it } from "vitest";
import { createTvVolume } from "./tvVolume";

describe("TvVolume", () => {
  it("is at full volume until the host says otherwise", () => {
    expect(createTvVolume().get()).toBe(100);
  });

  it("keeps integer volumes within 0–100", () => {
    const volume = createTvVolume();

    volume.set(-5)();
    expect(volume.get()).toBe(0);
    volume.set(120)();
    expect(volume.get()).toBe(100);
    volume.set(42.4)();
    expect(volume.get()).toBe(42);
  });

  it("tells its listeners about changes only, until they unsubscribe", () => {
    const volume = createTvVolume(50);
    const seen: number[] = [];
    const unsubscribe = volume.subscribe((v) => () => void seen.push(v))();

    volume.set(50)();
    volume.set(60)();
    unsubscribe();
    volume.set(70)();

    expect(seen).toEqual([60]);
  });
});
