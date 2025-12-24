/**
 * State Machine Tests - validates transitions driven by reducer
 */

import type { PlaybackSnapshot, PlayerCoreConfig } from "@hbb-emu/player-core";
import { PlayerCore } from "@hbb-emu/player-core";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockAdapter, type MockAdapter } from "./test-helpers";

const createSnapshot = (overrides: Partial<PlaybackSnapshot> = {}): PlaybackSnapshot => ({
  currentTime: 0,
  duration: 120,
  buffered: [],
  playbackRate: 1,
  paused: false,
  ...overrides,
});

const createRuntime = () => {
  const native = createMockAdapter("native");
  const hls = createMockAdapter("hls");
  const dash = createMockAdapter("dash");

  const config: PlayerCoreConfig = {
    adapters: { native, hls, dash },
  };

  return { runtime: new PlayerCore(config), native, hls, dash };
};

describe("PlayerCore - State Machine", () => {
  let runtime: PlayerCore;
  let native: MockAdapter;
  let video: HTMLVideoElement;

  beforeEach(() => {
    ({ runtime, native } = createRuntime());
    video = document.createElement("video");
  });

  it("Idle -> Loading on LoadRequested", async () => {
    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
    expect(runtime.getState()._tag).toBe("Control/Loading");
  });

  it("Loading -> Source/MP4/Ready on MetadataLoaded", async () => {
    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();

    await runtime.dispatch({
      _tag: "Engine/MetadataLoaded",
      url: "video.mp4",
      duration: 120,
      width: 1920,
      height: 1080,
    })();

    expect(runtime.getState()._tag).toBe("Source/MP4/Ready");
  });

  it("Paused -> Playing on PlayRequested (and calls adapter.play)", async () => {
    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
    await runtime.dispatch({ _tag: "Engine/Paused", snapshot: createSnapshot({ paused: true, currentTime: 10 }) })();

    await runtime.dispatch({ _tag: "Intent/PlayRequested" })();

    expect(runtime.getState()._tag).toBe("Control/Playing");
    expect(native.play).toHaveBeenCalledTimes(1);
  });

  it("Playing -> Paused on PauseRequested (and calls adapter.pause)", async () => {
    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
    await runtime.dispatch({ _tag: "Engine/Playing", snapshot: createSnapshot({ paused: false, currentTime: 10 }) })();

    await runtime.dispatch({ _tag: "Intent/PauseRequested" })();

    expect(runtime.getState()._tag).toBe("Control/Paused");
    expect(native.pause).toHaveBeenCalledTimes(1);
  });

  it("Playing -> Seeking on SeekRequested (and calls adapter.seek)", async () => {
    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
    await runtime.dispatch({ _tag: "Engine/Playing", snapshot: createSnapshot({ paused: false, currentTime: 10 }) })();

    await runtime.dispatch({ _tag: "Intent/SeekRequested", time: 30 })();

    const state = runtime.getState();
    expect(state._tag).toBe("Control/Seeking");
    if (state._tag === "Control/Seeking") {
      expect(state.fromTime).toBe(10);
      expect(state.toTime).toBe(30);
      expect(state.duration).toBe(120);
    }

    expect(native.seek).toHaveBeenCalledWith(30);
  });

  it("Engine events force control states", async () => {
    await runtime.dispatch({ _tag: "Engine/Playing", snapshot: createSnapshot({ paused: false, currentTime: 5 }) })();
    expect(runtime.getState()._tag).toBe("Control/Playing");

    await runtime.dispatch({ _tag: "Engine/Waiting", snapshot: createSnapshot({ currentTime: 6 }) })();
    expect(runtime.getState()._tag).toBe("Control/Buffering");

    await runtime.dispatch({ _tag: "Engine/Ended", snapshot: createSnapshot({ currentTime: 120 }) })();
    expect(runtime.getState()._tag).toBe("Control/Ended");
  });
});
