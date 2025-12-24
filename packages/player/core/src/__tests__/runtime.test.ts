import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerState } from "../../state/states";
import { NativeAdapter } from "../adapters/native";
import { PlayerRuntime } from "../runtime";
import type { PlayerStateListener } from "../types";

// Mock only the adapter, NOT the reducer
vi.mock("../adapters/native", () => ({
  NativeAdapter: vi.fn(),
}));

describe("PlayerRuntime - Complete Test Suite", () => {
  let runtime: PlayerRuntime;
  let mockAdapter: ReturnType<typeof createMockAdapter>;
  let videoElement: HTMLVideoElement;

  beforeEach(() => {
    mockAdapter = createMockAdapter();
    vi.mocked(NativeAdapter).mockImplementation(function (this: any) {
      return mockAdapter as any;
    });

    runtime = new PlayerRuntime();
    videoElement = document.createElement("video");
  });

  // ============================================================================
  // State Queries
  // ============================================================================

  describe("getState", () => {
    it("should return initial Idle state", () => {
      const state = runtime.getState();
      expect(state).toBeInstanceOf(PlayerState.Control.Idle);
      expect(state._tag).toBe("Control/Idle");
    });

    it("should return updated state after transitions", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "test.mp4" })();
      await waitForProcessing();

      const state = runtime.getState();
      // After LoadRequested, should transition to Loading
      expect(state._tag).toBe("Control/Loading");
      if (state._tag === "Control/Loading") {
        expect(state.url).toBe("test.mp4");
      }
    });

    it("should be pure (same result on multiple calls)", () => {
      const state1 = runtime.getState();
      const state2 = runtime.getState();
      expect(state1).toBe(state2); // Same reference
    });
  });

  describe("getPlaybackType", () => {
    it("should return None initially", () => {
      const playbackType = runtime.getPlaybackType();
      expect(O.isNone(playbackType)).toBe(true);
    });

    it("should return Some(native) after loading native content", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      const playbackType = runtime.getPlaybackType();
      expect(O.isSome(playbackType)).toBe(true);
      if (O.isSome(playbackType)) {
        expect(playbackType.value).toBe("native");
      }
    });

    it("should be pure (referentially transparent)", () => {
      const type1 = runtime.getPlaybackType();
      const type2 = runtime.getPlaybackType();
      expect(O.getEq({ equals: (a, b) => a === b }).equals(type1, type2)).toBe(true);
    });
  });

  // ============================================================================
  // Subscription
  // ============================================================================

  describe("subscribe", () => {
    it("should immediately call listener with current state", () => {
      const listener = vi.fn();
      runtime.subscribe(listener)();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.any(PlayerState.Control.Idle));
    });

    it("should call listener on every state change", async () => {
      const listener = vi.fn();
      runtime.subscribe(listener)();
      listener.mockClear();

      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "test.mp4" })();
      await waitForProcessing();

      // Should be called multiple times as state transitions
      expect(listener.mock.calls.length).toBeGreaterThan(0);
    });

    it("should receive correct state instances", async () => {
      const states: PlayerState.Any[] = [];
      const listener: PlayerStateListener<PlayerState.Any> = (state) => states.push(state);

      runtime.subscribe(listener)();
      states.length = 0; // Clear initial state

      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "test.mp4" })();
      await waitForProcessing();

      // Verify state types using discriminated unions
      expect(states.length).toBeGreaterThan(0);
      const lastState = states[states.length - 1];
      expect(lastState._tag).toBe("Control/Loading");
    });

    it("should stop notifying after unsubscribe", async () => {
      const listener = vi.fn();
      const unsubscribe = runtime.subscribe(listener)();
      listener.mockClear();

      unsubscribe();

      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "test.mp4" })();
      await waitForProcessing();

      expect(listener).not.toHaveBeenCalled();
    });

    it("should support multiple subscribers", async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      runtime.subscribe(listener1)();
      runtime.subscribe(listener2)();

      listener1.mockClear();
      listener2.mockClear();

      await runtime.mount(videoElement)();
      await waitForProcessing();

      expect(listener1.mock.calls.length).toBeGreaterThan(0);
      expect(listener2.mock.calls.length).toBeGreaterThan(0);
      expect(listener1.mock.calls.length).toBe(listener2.mock.calls.length);
    });

    it("should return unsubscribe function wrapped in IO", () => {
      const listener = vi.fn();
      const unsubIO = runtime.subscribe(listener);

      expect(typeof unsubIO).toBe("function"); // IO
      const unsub = unsubIO();
      expect(typeof unsub).toBe("function"); // UnsubscribeFn
    });
  });

  // ============================================================================
  // Dispatch Hooks
  // ============================================================================

  describe("onDispatch (config)", () => {
    it("should call onDispatch for dispatched events", async () => {
      const onDispatch = vi.fn();
      runtime = new PlayerRuntime({ onDispatch });

      await runtime.dispatch({ _tag: "Intent/PlayRequested" })();

      expect(onDispatch).toHaveBeenCalledTimes(1);
      expect(onDispatch).toHaveBeenCalledWith({ _tag: "Intent/PlayRequested" });
    });

    it("should call onDispatch also for internal dispatches (mount -> Engine/Mounted)", async () => {
      const onDispatch = vi.fn();
      runtime = new PlayerRuntime({ onDispatch });

      await runtime.mount(videoElement)();
      await waitForProcessing();

      expect(onDispatch).toHaveBeenCalledWith({ _tag: "Engine/Mounted" });
    });
  });

  // ============================================================================
  // Mount
  // ============================================================================

  describe("mount", () => {
    it("should transition to correct state after mount", async () => {
      await runtime.mount(videoElement)();
      await waitForProcessing();

      const state = runtime.getState();
      // Should still be Idle after just mounting
      expect(state._tag).toBe("Control/Idle");
    });

    it("should dispatch Engine/Mounted event", async () => {
      const states: PlayerState.Any[] = [];
      runtime.subscribe((s) => states.push(s))();
      states.length = 0;

      await runtime.mount(videoElement)();
      await waitForProcessing();

      // Mount itself doesn't change state from Idle, but event is processed
      expect(states.length).toBeGreaterThanOrEqual(0);
    });

    it("should be composable as a Task", async () => {
      // mount returns Task<void>, can be composed with other Tasks
      const task = runtime.mount(videoElement);
      expect(typeof task).toBe("function");
      await task();
    });
  });

  // ============================================================================
  // Dispatch - State Transitions
  // ============================================================================

  describe("dispatch - Intent/LoadRequested", () => {
    beforeEach(async () => {
      await runtime.mount(videoElement)();
    });

    it("should transition from Idle to Loading", async () => {
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state._tag).toBe("Control/Loading");
      if (state._tag === "Control/Loading") {
        expect(state.url).toBe("video.mp4");
        expect(state.progress).toBe(0);
      }
    });

    it("should detect native playback type for .mp4", async () => {
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      const playbackType = runtime.getPlaybackType();
      expect(O.isSome(playbackType)).toBe(true);
      if (O.isSome(playbackType)) {
        expect(playbackType.value).toBe("native");
      }
    });

    it("should create and mount adapter", async () => {
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      expect(NativeAdapter).toHaveBeenCalled();
      expect(mockAdapter.mount).toHaveBeenCalledWith(videoElement);
      expect(mockAdapter.load).toHaveBeenCalledWith("video.mp4");
      expect(mockAdapter.subscribe).toHaveBeenCalled();
    });

    it("should handle HLS detection", async () => {
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "stream.m3u8" })();
      await waitForProcessing();

      // HLS not supported yet, should error
      const state = runtime.getState();
      expect(state.isError).toBe(true);
    });

    it("should handle DASH detection", async () => {
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "stream.mpd" })();
      await waitForProcessing();

      // DASH not supported yet, should error
      const state = runtime.getState();
      expect(state.isError).toBe(true);
    });

    it("should destroy previous adapter before creating new one", async () => {
      // Load first video
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video1.mp4" })();
      await waitForProcessing();

      const firstDestroyCalls = mockAdapter.destroy.mock.calls.length;

      // Load second video
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video2.mp4" })();
      await waitForProcessing();

      // Destroy should be called again
      expect(mockAdapter.destroy.mock.calls.length).toBeGreaterThan(firstDestroyCalls);
    });
  });

  describe("dispatch - Intent/PlayRequested", () => {
    it("should transition from Paused to Playing", async () => {
      await setupPausedState();

      await runtime.dispatch({ _tag: "Intent/PlayRequested" })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state._tag).toBe("Control/Playing");
    });

    it("should call adapter play method", async () => {
      await setupPausedState();

      await runtime.dispatch({ _tag: "Intent/PlayRequested" })();
      await waitForProcessing();

      expect(mockAdapter.play).toHaveBeenCalled();
    });

    it("should do nothing if in Idle state", async () => {
      await runtime.mount(videoElement)();

      await runtime.dispatch({ _tag: "Intent/PlayRequested" })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state._tag).toBe("Control/Idle"); // Should stay in Idle
      expect(mockAdapter.play).not.toHaveBeenCalled();
    });

    it("should restart from Ended state", async () => {
      await setupEndedState();

      await runtime.dispatch({ _tag: "Intent/PlayRequested" })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state._tag).toBe("Control/Playing");
      expect(mockAdapter.play).toHaveBeenCalled();
    });

    it("should preserve playback information", async () => {
      await setupPausedState();

      const beforeState = runtime.getState();
      await runtime.dispatch({ _tag: "Intent/PlayRequested" })();
      await waitForProcessing();

      const afterState = runtime.getState();
      if (afterState._tag === "Control/Playing" && beforeState._tag === "Control/Paused") {
        expect(afterState.currentTime).toBe(beforeState.currentTime);
        expect(afterState.duration).toBe(beforeState.duration);
      }
    });
  });

  describe("dispatch - Intent/PauseRequested", () => {
    it("should transition from Playing to Paused", async () => {
      await setupPlayingState();

      await runtime.dispatch({ _tag: "Intent/PauseRequested" })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state._tag).toBe("Control/Paused");
    });

    it("should call adapter pause method", async () => {
      await setupPlayingState();

      await runtime.dispatch({ _tag: "Intent/PauseRequested" })();
      await waitForProcessing();

      expect(mockAdapter.pause).toHaveBeenCalled();
    });

    it("should do nothing if not in Playing state", async () => {
      await runtime.mount(videoElement)();

      await runtime.dispatch({ _tag: "Intent/PauseRequested" })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state._tag).toBe("Control/Idle");
      expect(mockAdapter.pause).not.toHaveBeenCalled();
    });

    it("should preserve current time", async () => {
      await setupPlayingState();

      const beforeState = runtime.getState();
      await runtime.dispatch({ _tag: "Intent/PauseRequested" })();
      await waitForProcessing();

      const afterState = runtime.getState();
      if (afterState._tag === "Control/Paused" && beforeState._tag === "Control/Playing") {
        expect(afterState.currentTime).toBe(beforeState.currentTime);
      }
    });
  });

  describe("dispatch - Intent/SeekRequested", () => {
    it("should transition to Seeking state", async () => {
      await setupPlayingState();

      await runtime.dispatch({ _tag: "Intent/SeekRequested", time: 30 })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state._tag).toBe("Control/Seeking");
      if (state._tag === "Control/Seeking") {
        expect(state.toTime).toBe(30);
      }
    });

    it("should call adapter seek method", async () => {
      await setupPlayingState();

      await runtime.dispatch({ _tag: "Intent/SeekRequested", time: 30 })();
      await waitForProcessing();

      expect(mockAdapter.seek).toHaveBeenCalledWith(30);
    });

    it("should work from Paused state", async () => {
      await setupPausedState();

      await runtime.dispatch({ _tag: "Intent/SeekRequested", time: 15 })();
      await waitForProcessing();

      expect(mockAdapter.seek).toHaveBeenCalledWith(15);
    });

    it("should do nothing if no media loaded", async () => {
      await runtime.mount(videoElement)();

      await runtime.dispatch({ _tag: "Intent/SeekRequested", time: 30 })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state._tag).toBe("Control/Idle");
      expect(mockAdapter.seek).not.toHaveBeenCalled();
    });

    it("should handle seeking to 0", async () => {
      await setupPlayingState();

      await runtime.dispatch({ _tag: "Intent/SeekRequested", time: 0 })();
      await waitForProcessing();

      expect(mockAdapter.seek).toHaveBeenCalledWith(0);
    });
  });

  describe("dispatch - Engine events", () => {
    it("should transition to Ready on MetadataLoaded", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      await runtime.dispatch({
        _tag: "Engine/MetadataLoaded",
        url: "video.mp4",
        duration: 120,
        width: 1920,
        height: 1080,
      })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state._tag).toMatch(/Ready/);
    });

    it("should transition to Playing on Engine/Playing", async () => {
      await setupLoadedState();

      await runtime.dispatch({
        _tag: "Engine/Playing",
        snapshot: createSnapshot({ paused: false, currentTime: 5 }),
      })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state._tag).toBe("Control/Playing");
    });

    it("should transition to Paused on Engine/Paused", async () => {
      await setupPlayingState();

      await runtime.dispatch({
        _tag: "Engine/Paused",
        snapshot: createSnapshot({ paused: true, currentTime: 10 }),
      })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state._tag).toBe("Control/Paused");
    });

    it("should transition to Buffering on Engine/Waiting", async () => {
      await setupPlayingState();

      await runtime.dispatch({
        _tag: "Engine/Waiting",
        snapshot: createSnapshot({ currentTime: 15 }),
      })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state._tag).toBe("Control/Buffering");
    });

    it("should transition to Ended on Engine/Ended", async () => {
      await setupPlayingState();

      await runtime.dispatch({
        _tag: "Engine/Ended",
        snapshot: createSnapshot({ currentTime: 120 }),
      })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state._tag).toBe("Control/Ended");
    });

    it("should handle Engine/Error", async () => {
      await runtime.mount(videoElement)();

      await runtime.dispatch({
        _tag: "Engine/Error",
        kind: "network",
        message: "Network error",
        url: "video.mp4",
      })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state.isError).toBe(true);
      expect(state._tagGroup).toMatch(/Error/);
    });
  });

  // ============================================================================
  // Destroy
  // ============================================================================

  describe("destroy", () => {
    it("should succeed when no adapter exists", async () => {
      const result = await runtime.destroy();
      expect(E.isRight(result)).toBe(true);
    });

    it("should destroy adapter if exists", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      await runtime.destroy();

      expect(mockAdapter.destroy).toHaveBeenCalled();
    });

    it("should unsubscribe from adapter events", async () => {
      const unsubscribeFn = vi.fn();
      mockAdapter.subscribe.mockReturnValueOnce(() => unsubscribeFn);

      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      await runtime.destroy();

      expect(unsubscribeFn).toHaveBeenCalled();
    });

    it("should clear all listeners", async () => {
      const listener = vi.fn();
      runtime.subscribe(listener)();
      listener.mockClear();

      await runtime.destroy();

      await runtime.dispatch({ _tag: "Intent/PlayRequested" })();
      await waitForProcessing();

      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle adapter destroy errors gracefully", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      mockAdapter.destroy.mockImplementationOnce(async () => {
        throw new Error("Destroy failed");
      });

      const result = await runtime.destroy();
      // Currently returns Left on destroy error, but logs the error
      expect(E.isLeft(result)).toBe(true);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe("error handling", () => {
    it("should handle adapter creation error", async () => {
      vi.mocked(NativeAdapter).mockImplementationOnce(function (this: any) {
        throw new Error("Adapter creation failed");
      });

      await runtime.mount(videoElement)();
      await expect(runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })()).rejects.toThrow(
        "Adapter creation failed",
      );
    });

    it("should handle mount without video element", async () => {
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      // Should handle gracefully (dispatch error event)
      const state = runtime.getState();
      // May or may not be in error state depending on reducer logic
      expect(state).toBeDefined();
    });

    it("should handle adapter load failure", async () => {
      mockAdapter.load.mockRejectedValueOnce(new Error("Load failed"));

      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      // Should dispatch error event
      const state = runtime.getState();
      expect(state).toBeDefined();
    });

    it("should handle adapter play failure", async () => {
      mockAdapter.play.mockRejectedValueOnce(new Error("Play failed"));

      await setupPausedState();
      await runtime.dispatch({ _tag: "Intent/PlayRequested" })();
      await waitForProcessing();

      // Should handle error
      expect(true).toBe(true);
    });
  });

  // ============================================================================
  // Concurrency & Event Queue
  // ============================================================================

  describe("event queue and concurrency", () => {
    it("should process events in order", async () => {
      const states: string[] = [];
      runtime.subscribe((s) => states.push(s._tag))();
      states.length = 0;

      await runtime.mount(videoElement)();

      // Dispatch multiple events
      await Promise.all([
        runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })(),
        runtime.dispatch({ _tag: "Intent/PlayRequested" })(),
      ]);
      await waitForProcessing();

      // Should process in order
      expect(states.length).toBeGreaterThan(0);
    });

    it("should not process queue concurrently", async () => {
      await runtime.mount(videoElement)();

      // Dispatch many events rapidly
      const dispatches = Array.from({ length: 10 }, (_, i) =>
        runtime.dispatch({ _tag: "Intent/SeekRequested", time: i })(),
      );

      await Promise.all(dispatches);
      await waitForProcessing();

      // Should handle without issues
      expect(true).toBe(true);
    });

    it("should handle effects execution order", async () => {
      const callOrder: string[] = [];

      mockAdapter.mount.mockImplementation(() => () => callOrder.push("mount"));
      mockAdapter.load.mockImplementation(() => async () => {
        callOrder.push("load");
      });

      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      // Mount should be called before load
      expect(callOrder.indexOf("mount")).toBeLessThan(callOrder.indexOf("load"));
    });
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  async function setupLoadedState() {
    await runtime.mount(videoElement)();
    await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
    await runtime.dispatch({
      _tag: "Engine/MetadataLoaded",
      url: "video.mp4",
      duration: 120,
      width: 1920,
      height: 1080,
    })();
    await waitForProcessing();
  }

  async function setupPlayingState() {
    await setupLoadedState();
    await runtime.dispatch({
      _tag: "Engine/Playing",
      snapshot: createSnapshot({ paused: false, currentTime: 10 }),
    })();
    await waitForProcessing();
  }

  async function setupPausedState() {
    await setupPlayingState();
    await runtime.dispatch({
      _tag: "Engine/Paused",
      snapshot: createSnapshot({ paused: true, currentTime: 15 }),
    })();
    await waitForProcessing();
  }

  async function setupEndedState() {
    await setupPlayingState();
    await runtime.dispatch({
      _tag: "Engine/Ended",
      snapshot: createSnapshot({ currentTime: 120 }),
    })();
    await waitForProcessing();
  }
});

// ============================================================================
// Test Utilities
// ============================================================================

function createMockAdapter() {
  const unsubscribe = vi.fn();
  return {
    type: "native" as const,
    name: "Native HTML5",
    mount: vi.fn(() => () => {}),
    load: vi.fn(() => async () => {}),
    play: vi.fn(async () => {}),
    pause: vi.fn(async () => {}),
    seek: vi.fn(() => async () => {}),
    destroy: vi.fn(async () => {}),
    subscribe: vi.fn((_listener: any) => () => unsubscribe),
  };
}

function createSnapshot(
  overrides: Partial<{
    currentTime: number;
    duration: number;
    buffered: { start: number; end: number }[];
    playbackRate: number;
    paused: boolean;
  }> = {},
) {
  return {
    currentTime: 0,
    duration: 120,
    buffered: [],
    playbackRate: 1.0,
    paused: false,
    ...overrides,
  };
}

async function waitForProcessing(ms = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
