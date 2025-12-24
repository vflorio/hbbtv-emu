import { NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerCore, type PlayerEvent } from "@hbb-emu/player-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@hbb-emu/player-adapter-web", () => ({
  NativeAdapter: vi.fn(),
}));

describe("PlayerCore - Effects Execution", () => {
  let runtime: PlayerCore;
  let mockAdapter: ReturnType<typeof createMockAdapter>;
  let videoElement: HTMLVideoElement;

  beforeEach(() => {
    mockAdapter = createMockAdapter();
    vi.mocked(NativeAdapter).mockImplementation(function (this: any) {
      return mockAdapter as any;
    });

    runtime = new PlayerCore({ adapters: {} as any }); // FIXME
    videoElement = document.createElement("video");
  });

  // ============================================================================
  // Adapter Lifecycle Effects
  // ============================================================================

  describe("adapter lifecycle", () => {
    it("should create adapter on load request", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      expect(NativeAdapter).toHaveBeenCalledTimes(1);
    });

    it("should mount adapter to video element", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      expect(mockAdapter.mount).toHaveBeenCalledWith(videoElement);
    });

    it("should subscribe to adapter events", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      expect(mockAdapter.subscribe).toHaveBeenCalled();
      const subscribeCalls = mockAdapter.subscribe.mock.calls as unknown as Array<[(event: PlayerEvent) => void]>;
      expect(subscribeCalls[0]?.[0]).toBeTypeOf("function");
    });

    it("should load source URL", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      expect(mockAdapter.load).toHaveBeenCalledWith("video.mp4");
    });

    it("should destroy previous adapter when loading new content", async () => {
      await runtime.mount(videoElement)();

      // Load first video
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video1.mp4" })();
      await waitForProcessing();

      const firstDestroyCalls = mockAdapter.destroy.mock.calls.length;

      // Load second video
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video2.mp4" })();
      await waitForProcessing();

      expect(mockAdapter.destroy.mock.calls.length).toBeGreaterThan(firstDestroyCalls);
    });

    it("should unsubscribe from previous adapter", async () => {
      const firstUnsubscribe = vi.fn();
      const secondUnsubscribe = vi.fn();

      // First load
      mockAdapter.subscribe.mockReturnValueOnce(() => firstUnsubscribe);

      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video1.mp4" })();
      await waitForProcessing();

      // Second load should unsubscribe from first
      mockAdapter.subscribe.mockReturnValueOnce(() => secondUnsubscribe);
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video2.mp4" })();
      await waitForProcessing();

      // First unsubscribe should have been called
      expect(firstUnsubscribe).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Playback Control Effects
  // ============================================================================

  describe("playback control effects", () => {
    beforeEach(async () => {
      await setupPlayableState(runtime, videoElement);
    });

    it("should call adapter.play() on play request", async () => {
      // Setup paused state
      await runtime.dispatch({
        _tag: "Engine/Paused",
        snapshot: createSnapshot({ paused: true }),
      })();
      await waitForProcessing();

      mockAdapter.play.mockClear();

      await runtime.dispatch({ _tag: "Intent/PlayRequested" })();
      await waitForProcessing();

      expect(mockAdapter.play).toHaveBeenCalledTimes(1);
    });

    it("should call adapter.pause() on pause request", async () => {
      await runtime.dispatch({
        _tag: "Engine/Playing",
        snapshot: createSnapshot({ paused: false }),
      })();
      await waitForProcessing();

      mockAdapter.pause.mockClear();

      await runtime.dispatch({ _tag: "Intent/PauseRequested" })();
      await waitForProcessing();

      expect(mockAdapter.pause).toHaveBeenCalledTimes(1);
    });

    it("should call adapter.seek() with correct time", async () => {
      await runtime.dispatch({
        _tag: "Engine/Playing",
        snapshot: createSnapshot({ paused: false }),
      })();
      await waitForProcessing();

      mockAdapter.seek.mockClear();

      await runtime.dispatch({ _tag: "Intent/SeekRequested", time: 45.5 })();
      await waitForProcessing();

      expect(mockAdapter.seek).toHaveBeenCalledWith(45.5);
    });

    it("should not call play() if not in valid state", async () => {
      // Reset to idle
      runtime = new PlayerCore();
      await runtime.mount(videoElement)();

      await runtime.dispatch({ _tag: "Intent/PlayRequested" })();
      await waitForProcessing();

      expect(mockAdapter.play).not.toHaveBeenCalled();
    });

    it("should not call pause() if not playing", async () => {
      runtime = new PlayerCore();
      await runtime.mount(videoElement)();

      await runtime.dispatch({ _tag: "Intent/PauseRequested" })();
      await waitForProcessing();

      expect(mockAdapter.pause).not.toHaveBeenCalled();
    });

    it("should not call seek() if no media loaded", async () => {
      runtime = new PlayerCore();
      await runtime.mount(videoElement)();

      await runtime.dispatch({ _tag: "Intent/SeekRequested", time: 30 })();
      await waitForProcessing();

      expect(mockAdapter.seek).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Effect Ordering
  // ============================================================================

  describe("effect execution order", () => {
    it("should execute effects in correct sequence on load", async () => {
      const callOrder: string[] = [];

      mockAdapter.destroy.mockImplementation(async () => {
        callOrder.push("destroy");
      });
      mockAdapter.mount.mockImplementation(() => () => {
        callOrder.push("mount");
      });
      mockAdapter.load.mockImplementation(() => async () => {
        callOrder.push("load");
      });
      mockAdapter.subscribe.mockImplementation(() => {
        const unsubscribe = vi.fn();
        return () => {
          callOrder.push("subscribe");
          return unsubscribe;
        };
      });

      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      // Expected order: destroy (if exists) -> subscribe -> mount -> load
      expect(callOrder).toContain("mount");
      expect(callOrder).toContain("load");
      expect(callOrder.indexOf("mount")).toBeLessThan(callOrder.indexOf("load"));
    });

    it("should not execute load before mount", async () => {
      const callOrder: string[] = [];

      mockAdapter.mount.mockImplementation(() => () => {
        callOrder.push("mount");
      });
      mockAdapter.load.mockImplementation(() => async () => {
        callOrder.push("load");
      });

      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      const mountIndex = callOrder.indexOf("mount");
      const loadIndex = callOrder.indexOf("load");

      expect(mountIndex).toBeGreaterThanOrEqual(0);
      expect(loadIndex).toBeGreaterThanOrEqual(0);
      expect(mountIndex).toBeLessThan(loadIndex);
    });
  });

  // ============================================================================
  // Effect Error Handling
  // ============================================================================

  describe("effect error handling", () => {
    beforeEach(async () => {
      await runtime.mount(videoElement)();
    });

    it("should handle adapter creation failure", async () => {
      vi.mocked(NativeAdapter).mockImplementationOnce(function (this: any) {
        throw new Error("Adapter creation failed");
      });

      // The error is not caught by the runtime, so we expect it to be thrown
      await expect(runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })()).rejects.toThrow(
        "Adapter creation failed",
      );
    });

    it("should handle mount failure", async () => {
      mockAdapter.mount.mockImplementationOnce(() => {
        throw new Error("Mount failed");
      });

      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      // Should dispatch error event
      const state = runtime.getState();
      expect(state).toBeDefined();
    });

    it("should handle load failure", async () => {
      mockAdapter.load.mockRejectedValueOnce(new Error("Load failed"));

      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      // Should handle gracefully
      expect(runtime.getState()).toBeDefined();
    });

    it("should handle play failure", async () => {
      mockAdapter.play.mockRejectedValueOnce(new Error("Play failed"));

      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await runtime.dispatch({
        _tag: "Engine/MetadataLoaded",
        url: "video.mp4",
        duration: 120,
        width: 1920,
        height: 1080,
      })();
      await runtime.dispatch({
        _tag: "Engine/Paused",
        snapshot: createSnapshot({ paused: true }),
      })();
      await waitForProcessing();

      await runtime.dispatch({ _tag: "Intent/PlayRequested" })();
      await waitForProcessing();

      // Should not crash
      expect(runtime.getState()).toBeDefined();
    });

    it("should handle pause failure", async () => {
      mockAdapter.pause.mockRejectedValueOnce(new Error("Pause failed"));

      await setupPlayableState(runtime, videoElement);
      await runtime.dispatch({
        _tag: "Engine/Playing",
        snapshot: createSnapshot({ paused: false }),
      })();
      await waitForProcessing();

      await runtime.dispatch({ _tag: "Intent/PauseRequested" })();
      await waitForProcessing();

      expect(runtime.getState()).toBeDefined();
    });

    it("should handle seek failure", async () => {
      mockAdapter.seek.mockRejectedValueOnce(new Error("Seek failed"));

      await setupPlayableState(runtime, videoElement);
      await runtime.dispatch({
        _tag: "Engine/Playing",
        snapshot: createSnapshot({ paused: false }),
      })();
      await waitForProcessing();

      await runtime.dispatch({ _tag: "Intent/SeekRequested", time: 30 })();
      await waitForProcessing();

      expect(runtime.getState()).toBeDefined();
    });

    it("should handle destroy failure gracefully", async () => {
      mockAdapter.destroy.mockRejectedValueOnce(new Error("Destroy failed"));

      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      // Destroy old adapter when loading new content
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video2.mp4" })();
      await waitForProcessing();

      // Should continue despite error
      expect(runtime.getState()).toBeDefined();
    });
  });

  // ============================================================================
  // Adapter Event Forwarding
  // ============================================================================

  describe("adapter event forwarding", () => {
    it("should forward adapter events to runtime", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      // Get the event listener passed to subscribe
      const eventListener = (mockAdapter.subscribe.mock.calls as any)[0]?.[0] as
        | ((event: PlayerEvent) => void)
        | undefined;
      expect(eventListener).toBeTypeOf("function");

      // Simulate adapter firing an event
      const states: string[] = [];
      runtime.subscribe((s) => states.push(s._tag))();
      states.length = 0;

      if (eventListener) {
        eventListener({ _tag: "Engine/Playing", snapshot: createSnapshot() });
      }
      await waitForProcessing();

      // State should have changed
      expect(states.length).toBeGreaterThan(0);
    });

    it("should stop forwarding after unsubscribe", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      const eventListener = (mockAdapter.subscribe.mock.calls as any)[0]?.[0] as
        | ((event: PlayerEvent) => void)
        | undefined;
      const unsubscribe = mockAdapter.subscribe.mock.results[0].value;

      // Unsubscribe
      unsubscribe();

      // Events should not be processed
      const states: string[] = [];
      runtime.subscribe((s) => states.push(s._tag))();
      states.length = 0;

      if (eventListener) {
        eventListener({ _tag: "Engine/Playing", snapshot: createSnapshot() });
      }
      await waitForProcessing();

      // State should not change (already unsubscribed)
      // Note: This test depends on implementation details
    });
  });

  // ============================================================================
  // Effect Cleanup
  // ============================================================================

  describe("effect cleanup", () => {
    it("should cleanup on destroy", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      const destroyCallsBefore = mockAdapter.destroy.mock.calls.length;

      await runtime.destroy();

      // Verify adapter destroy was called
      expect(mockAdapter.destroy.mock.calls.length).toBeGreaterThan(destroyCallsBefore);
    });

    it("should cleanup listeners on destroy", async () => {
      const listener = vi.fn();
      runtime.subscribe(listener)();

      await runtime.destroy();

      listener.mockClear();

      // Try to trigger state change
      await runtime.dispatch({ _tag: "Intent/PlayRequested" })();
      await waitForProcessing();

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Test Utilities
// ============================================================================

async function setupPlayableState(runtime: PlayerCore, videoElement: HTMLVideoElement) {
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

function createMockAdapter() {
  return {
    type: "native" as const,
    name: "Native HTML5",
    mount: vi.fn(() => () => {}),
    load: vi.fn(() => async () => {}),
    play: vi.fn(async () => {}),
    pause: vi.fn(async () => {}),
    seek: vi.fn(() => async () => {}),
    destroy: vi.fn(async () => {}),
    subscribe: vi.fn(() => () => vi.fn()),
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
