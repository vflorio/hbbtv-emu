import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerRuntime } from "../runtime";
import type { PlayerEvent, PlayerRuntimeConfig } from "../types";
import { createMockAdapter, type MockAdapter } from "./test-helpers";

const createRuntime = () => {
  const native = createMockAdapter("native");
  const hls = createMockAdapter("hls");
  const dash = createMockAdapter("dash");

  const config: PlayerRuntimeConfig = {
    adapters: { native, hls, dash },
  };

  return { runtime: new PlayerRuntime(config), native, hls, dash };
};

describe("PlayerRuntime - API surface", () => {
  let runtime: PlayerRuntime;
  let native: MockAdapter;
  let video: HTMLVideoElement;

  beforeEach(() => {
    ({ runtime, native } = createRuntime());
    video = document.createElement("video");
  });

  it("getState returns Idle initially and is referentially stable until changes", () => {
    const s1 = runtime.getState();
    const s2 = runtime.getState();
    expect(s1._tag).toBe("Control/Idle");
    expect(s1).toBe(s2);
  });

  it("subscribeToState immediately emits current state and unsubscribes", async () => {
    const listener = vi.fn();
    const unsub = runtime.subscribeToState(listener)();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]._tag).toBe("Control/Idle");

    listener.mockClear();
    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();

    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    unsub();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video2.mp4" })();
    expect(listener).not.toHaveBeenCalled();
  });

  it("subscribeToEvents sees both external and internal events", async () => {
    const events: PlayerEvent[] = [];
    runtime.subscribeToEvents((e) => events.push(e))();

    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/PlayRequested" })();

    expect(events.some((e) => e._tag === "Engine/Mounted")).toBe(true);
    expect(events.some((e) => e._tag === "Intent/PlayRequested")).toBe(true);
  });

  it("getPlaybackType is None initially and Some after LoadRequested", async () => {
    expect(O.isNone(runtime.getPlaybackType())).toBe(true);

    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();

    const playbackType = runtime.getPlaybackType();
    expect(O.isSome(playbackType)).toBe(true);
    if (O.isSome(playbackType)) {
      expect(playbackType.value).toBe("native");
    }
  });

  it("destroy returns Right when no adapter exists", async () => {
    const result = await runtime.destroy();
    expect(E.isRight(result)).toBe(true);
  });

  it("destroy calls adapter.destroy and clears playbackType", async () => {
    await runtime.mount(video)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();

    expect(O.isSome(runtime.getPlaybackType())).toBe(true);

    const result = await runtime.destroy();
    expect(E.isRight(result)).toBe(true);
    expect(native.destroy).toHaveBeenCalledTimes(1);
    expect(O.isNone(runtime.getPlaybackType())).toBe(true);
  });
});
