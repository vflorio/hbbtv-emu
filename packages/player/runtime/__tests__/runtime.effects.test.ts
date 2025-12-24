import type { PlaybackSnapshot, PlayerEvent, PlayerRuntimeConfig } from "@hbb-emu/player-runtime";
import { PlayerRuntime } from "@hbb-emu/player-runtime";
import * as O from "fp-ts/Option";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAdapter, type MockAdapter } from "./test-helpers";

const createRuntime = (overrides?: Partial<Record<"native" | "hls" | "dash", MockAdapter>>) => {
  const native = overrides?.native ?? createMockAdapter("native");
  const hls = overrides?.hls ?? createMockAdapter("hls");
  const dash = overrides?.dash ?? createMockAdapter("dash");

  const config: PlayerRuntimeConfig = {
    adapters: { native, hls, dash },
  };

  return { runtime: new PlayerRuntime(config), native, hls, dash };
};

const createSnapshot = (overrides: Partial<PlaybackSnapshot> = {}): PlaybackSnapshot => ({
  currentTime: 0,
  duration: 120,
  buffered: [],
  playbackRate: 1,
  paused: false,
  ...overrides,
});

describe("PlayerRuntime - Effects", () => {
  let runtime: PlayerRuntime;
  let native: MockAdapter;
  let hls: MockAdapter;
  let dash: MockAdapter;
  let video: HTMLVideoElement;

  beforeEach(() => {
    ({ runtime, native, hls, dash } = createRuntime());
    video = document.createElement("video");
  });

  it("selects native adapter for .mp4 and attaches/loads", async () => {
    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();

    expect(native.subscribe).toHaveBeenCalledTimes(1);
    expect(native.mount).toHaveBeenCalledWith(video);
    expect(native.load).toHaveBeenCalledWith("video.mp4");

    expect(hls.mount).not.toHaveBeenCalled();
    expect(dash.mount).not.toHaveBeenCalled();

    const playbackType = runtime.getPlaybackType();
    expect(O.isSome(playbackType)).toBe(true);
    if (O.isSome(playbackType)) {
      expect(playbackType.value).toBe("native");
    }
  });

  it("selects hls adapter for .m3u8 and attaches/loads", async () => {
    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "stream.m3u8" })();

    expect(hls.subscribe).toHaveBeenCalledTimes(1);
    expect(hls.mount).toHaveBeenCalledWith(video);
    expect(hls.load).toHaveBeenCalledWith("stream.m3u8");

    expect(native.mount).not.toHaveBeenCalled();
    expect(dash.mount).not.toHaveBeenCalled();

    const playbackType = runtime.getPlaybackType();
    expect(O.isSome(playbackType)).toBe(true);
    if (O.isSome(playbackType)) {
      expect(playbackType.value).toBe("hls");
    }
  });

  it("destroys previous adapter and unsubscribes on second load", async () => {
    const unsubscribeNative = vi.fn();
    native.subscribe.mockImplementationOnce((_listener) => () => unsubscribeNative);

    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();

    native.destroy.mockClear();

    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "stream.m3u8" })();

    expect(unsubscribeNative).toHaveBeenCalledTimes(1);
    expect(native.destroy).toHaveBeenCalledTimes(1);

    expect(hls.mount).toHaveBeenCalledWith(video);
    expect(hls.load).toHaveBeenCalledWith("stream.m3u8");
  });

  it("dispatches CoreError/NoVideoElement when load is requested before mount", async () => {
    const events: PlayerEvent[] = [];
    runtime.subscribeToEvents((e) => events.push(e))();

    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();

    expect(events.some((e) => e._tag === "CoreError/NoVideoElement")).toBe(true);
    expect(native.mount).not.toHaveBeenCalled();
  });

  it("dispatches CoreError/AdapterFailure when adapter load fails", async () => {
    native.load.mockImplementationOnce((_url) => async () => {
      throw new Error("Load failed");
    });

    const events: PlayerEvent[] = [];
    runtime.subscribeToEvents((e) => events.push(e))();

    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();

    const failure = events.find((e) => e._tag === "CoreError/AdapterFailure");
    expect(failure?._tag).toBe("CoreError/AdapterFailure");
    if (failure?._tag === "CoreError/AdapterFailure") {
      expect(failure.operation).toBe("load");
    }

    // state itself does not automatically become an error on core errors
    expect(runtime.getState()._tag).toBe("Control/Loading");

    // engine errors *do* move state into error
    await runtime.dispatch({
      _tag: "Engine/Error",
      kind: "network",
      message: "Network",
      url: "video.mp4",
    })();

    expect(runtime.getState().isError).toBe(true);
  });

  it("play/pause/seek effects call adapter methods (when adapter exists)", async () => {
    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
    await runtime.dispatch({
      _tag: "Engine/Paused",
      snapshot: createSnapshot({ paused: true, currentTime: 10 }),
    })();

    await runtime.dispatch({ _tag: "Intent/PlayRequested" })();
    expect(native.play).toHaveBeenCalledTimes(1);

    await runtime.dispatch({
      _tag: "Engine/Playing",
      snapshot: createSnapshot({ paused: false, currentTime: 10 }),
    })();

    await runtime.dispatch({ _tag: "Intent/PauseRequested" })();
    expect(native.pause).toHaveBeenCalledTimes(1);

    await runtime.dispatch({ _tag: "Intent/SeekRequested", time: 42.5 })();
    expect(native.seek).toHaveBeenCalledWith(42.5);
  });
});
