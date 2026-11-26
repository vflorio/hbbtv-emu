import type { PlayerEngineEvent } from "@hbb-emu/player-runtime";
import { describe, expect, it } from "vitest";
import { NativeAdapter } from "./native";

describe("NativeAdapter", () => {
  /** A video element left by the previous media: loaded, at its end. */
  const endedVideo = () => {
    const video = document.createElement("video");
    Object.defineProperties(video, {
      ended: { get: () => true, configurable: true },
      paused: { get: () => true, configurable: true },
      readyState: { get: () => HTMLMediaElement.HAVE_ENOUGH_DATA, configurable: true },
      duration: { get: () => 1, configurable: true },
    });
    return video;
  };

  it("mounted to load a new source, reports nothing of the element's previous media", () => {
    const adapter = new NativeAdapter();
    const events: PlayerEngineEvent[] = [];
    adapter.subscribe((event) => void events.push(event))();

    adapter.mount(endedVideo())();

    expect(events.map((event) => event._tag)).toEqual([
      "Engine/VolumeChanged",
      "Engine/MutedChanged",
      "Engine/Mounted",
    ]);
  });
});
