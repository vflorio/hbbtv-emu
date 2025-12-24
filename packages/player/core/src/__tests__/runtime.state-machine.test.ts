/**
 * State Machine Tests - Validates all valid state transitions
 *
 * This test suite validates the state machine behavior using a table-driven approach.
 * Each test validates: initial state -> event -> expected state + effects
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeAdapter } from "../adapters/native";
import { PlayerRuntime } from "../runtime";
import type { PlayerEvent } from "../types";

vi.mock("../adapters/native", () => ({
  NativeAdapter: vi.fn(),
}));

describe("PlayerRuntime - State Machine Transitions", () => {
  let runtime: PlayerRuntime;
  let videoElement: HTMLVideoElement;
  let mockAdapter: ReturnType<typeof createMockAdapter>;
  let adapterEventListener: ((event: PlayerEvent) => void) | undefined;

  beforeEach(() => {
    adapterEventListener = undefined;
    mockAdapter = createMockAdapter();

    // Capture the event listener when subscribe is called
    mockAdapter.subscribe.mockImplementation((listener: any) => {
      adapterEventListener = listener;
      return () => vi.fn();
    });

    // Make adapter methods emit appropriate engine events
    mockAdapter.play.mockImplementation(async () => {
      await Promise.resolve(); // Let the effect execute first
      const currentState = runtime.getState();
      const currentTime = "currentTime" in currentState ? currentState.currentTime : 0;
      adapterEventListener?.({
        _tag: "Engine/Playing",
        snapshot: createSnapshot({ paused: false, currentTime }),
      });
    });

    mockAdapter.pause.mockImplementation(async () => {
      await Promise.resolve(); // Let the effect execute first
      const currentState = runtime.getState();
      const currentTime = "currentTime" in currentState ? currentState.currentTime : 0;
      adapterEventListener?.({
        _tag: "Engine/Paused",
        snapshot: createSnapshot({ paused: true, currentTime }),
      });
    });

    vi.mocked(NativeAdapter).mockImplementation(function (this: any) {
      return mockAdapter as any;
    });

    runtime = new PlayerRuntime();
    videoElement = document.createElement("video");
  });

  /**
   * Transition Table Tests
   * Format: [initialState, event, expectedState, description]
   */
  const transitions: Array<{
    from: string;
    event: PlayerEvent;
    to: string;
    description: string;
    setup?: () => Promise<void>;
  }> = [
    {
      from: "Control/Idle",
      event: { _tag: "Intent/LoadRequested", url: "video.mp4" },
      to: "Control/Loading",
      description: "Load request from Idle should transition to Loading",
      setup: async () => {
        await runtime.mount(videoElement)();
      },
    },
    {
      from: "Control/Paused",
      event: { _tag: "Intent/PlayRequested" },
      to: "Control/Playing",
      description: "Play request from Paused should transition to Playing",
      setup: async () => {
        await setupState(runtime, videoElement, "Control/Paused");
      },
    },
    {
      from: "Control/Playing",
      event: { _tag: "Intent/PauseRequested" },
      to: "Control/Paused",
      description: "Pause request from Playing should transition to Paused",
      setup: async () => {
        await setupState(runtime, videoElement, "Control/Playing");
      },
    },
    {
      from: "Control/Playing",
      event: { _tag: "Intent/SeekRequested", time: 30 },
      to: "Control/Seeking",
      description: "Seek request from Playing should transition to Seeking",
      setup: async () => {
        await setupState(runtime, videoElement, "Control/Playing");
      },
    },
    {
      from: "Control/Paused",
      event: { _tag: "Intent/SeekRequested", time: 30 },
      to: "Control/Seeking",
      description: "Seek request from Paused should transition to Seeking",
      setup: async () => {
        await setupState(runtime, videoElement, "Control/Paused");
      },
    },
    {
      from: "Control/Ended",
      event: { _tag: "Intent/PlayRequested" },
      to: "Control/Playing",
      description: "Play request from Ended should restart playback",
      setup: async () => {
        await setupState(runtime, videoElement, "Control/Ended");
      },
    },
  ];

  describe("valid state transitions", () => {
    transitions.forEach(({ from, event, to, description, setup }) => {
      it(description, async () => {
        // Setup initial state
        if (setup) {
          await setup();
        }

        // Verify initial state
        const initialState = runtime.getState();
        expect(initialState._tag).toBe(from);

        // Dispatch event
        await runtime.dispatch(event)();
        await waitForProcessing();

        // Verify final state
        const finalState = runtime.getState();
        expect(finalState._tag).toBe(to);
      });
    });
  });

  /**
   * Invalid Transitions - Events that should NOT change state
   */
  const invalidTransitions: Array<{
    from: string;
    event: PlayerEvent;
    description: string;
    setup?: () => Promise<void>;
  }> = [
    {
      from: "Control/Idle",
      event: { _tag: "Intent/PlayRequested" },
      description: "Play request in Idle should be ignored",
      setup: async () => {
        await runtime.mount(videoElement)();
      },
    },
    {
      from: "Control/Idle",
      event: { _tag: "Intent/PauseRequested" },
      description: "Pause request in Idle should be ignored",
      setup: async () => {
        await runtime.mount(videoElement)();
      },
    },
    {
      from: "Control/Idle",
      event: { _tag: "Intent/SeekRequested", time: 30 },
      description: "Seek request in Idle should be ignored",
      setup: async () => {
        await runtime.mount(videoElement)();
      },
    },
    {
      from: "Control/Playing",
      event: { _tag: "Intent/PlayRequested" },
      description: "Play request while already Playing should be ignored",
      setup: async () => {
        await setupState(runtime, videoElement, "Control/Playing");
      },
    },
    {
      from: "Control/Paused",
      event: { _tag: "Intent/PauseRequested" },
      description: "Pause request while already Paused should be ignored",
      setup: async () => {
        await setupState(runtime, videoElement, "Control/Paused");
      },
    },
  ];

  describe("invalid state transitions", () => {
    invalidTransitions.forEach(({ from, event, description, setup }) => {
      it(description, async () => {
        // Setup initial state
        if (setup) {
          await setup();
        }

        const initialState = runtime.getState();
        expect(initialState._tag).toBe(from);

        // Dispatch event
        await runtime.dispatch(event)();
        await waitForProcessing();

        // State should remain unchanged
        const finalState = runtime.getState();
        expect(finalState._tag).toBe(from);
      });
    });
  });

  /**
   * Engine Event Transitions
   */
  describe("engine event transitions", () => {
    it("MetadataLoaded: Loading -> Ready", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await waitForProcessing();

      expect(runtime.getState()._tag).toBe("Control/Loading");

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

    it("Playing: Any playable state -> Playing", async () => {
      await setupState(runtime, videoElement, "Control/Paused");

      await runtime.dispatch({
        _tag: "Engine/Playing",
        snapshot: createSnapshot({ paused: false }),
      })();
      await waitForProcessing();

      expect(runtime.getState()._tag).toBe("Control/Playing");
    });

    it("Paused: Any playable state -> Paused", async () => {
      await setupState(runtime, videoElement, "Control/Playing");

      await runtime.dispatch({
        _tag: "Engine/Paused",
        snapshot: createSnapshot({ paused: true }),
      })();
      await waitForProcessing();

      expect(runtime.getState()._tag).toBe("Control/Paused");
    });

    it("Waiting: Playing -> Buffering", async () => {
      await setupState(runtime, videoElement, "Control/Playing");

      await runtime.dispatch({
        _tag: "Engine/Waiting",
        snapshot: createSnapshot(),
      })();
      await waitForProcessing();

      expect(runtime.getState()._tag).toBe("Control/Buffering");
    });

    it("Ended: Playing -> Ended", async () => {
      await setupState(runtime, videoElement, "Control/Playing");

      await runtime.dispatch({
        _tag: "Engine/Ended",
        snapshot: createSnapshot({ currentTime: 120 }),
      })();
      await waitForProcessing();

      expect(runtime.getState()._tag).toBe("Control/Ended");
    });

    it("Error: Any state -> Error state", async () => {
      await runtime.mount(videoElement)();

      await runtime.dispatch({
        _tag: "Engine/Error",
        kind: "network",
        message: "Network error",
      })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state.isError).toBe(true);
    });
  });

  /**
   * State Properties Validation
   */
  describe("state properties", () => {
    it("Playing state should have valid time properties", async () => {
      await setupState(runtime, videoElement, "Control/Playing");

      const state = runtime.getState();
      if (state._tag === "Control/Playing") {
        expect(state.currentTime).toBeGreaterThanOrEqual(0);
        expect(state.duration).toBeGreaterThan(0);
        expect(state.playbackRate).toBeGreaterThan(0);
        expect(Array.isArray(state.buffered)).toBe(true);
      }
    });

    it("Paused state should preserve time information", async () => {
      await setupState(runtime, videoElement, "Control/Playing");

      const playingState = runtime.getState();

      await runtime.dispatch({ _tag: "Intent/PauseRequested" })();
      await waitForProcessing();

      const pausedState = runtime.getState();
      if (pausedState._tag === "Control/Paused" && playingState._tag === "Control/Playing") {
        expect(pausedState.currentTime).toBe(playingState.currentTime);
        expect(pausedState.duration).toBe(playingState.duration);
      }
    });

    it("Loading state should have URL", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "test.mp4" })();
      await waitForProcessing();

      const state = runtime.getState();
      if (state._tag === "Control/Loading") {
        expect(state.url).toBe("test.mp4");
        expect(state.progress).toBeGreaterThanOrEqual(0);
      }
    });

    it("Seeking state should have from/to times", async () => {
      await setupState(runtime, videoElement, "Control/Playing");

      await runtime.dispatch({ _tag: "Intent/SeekRequested", time: 50 })();
      await waitForProcessing();

      const state = runtime.getState();
      if (state._tag === "Control/Seeking") {
        expect(state.toTime).toBe(50);
        expect(typeof state.fromTime).toBe("number");
      }
    });

    it("Error states should have error information", async () => {
      await runtime.mount(videoElement)();
      await runtime.dispatch({
        _tag: "Engine/Error",
        kind: "network",
        message: "Test error",
      })();
      await waitForProcessing();

      const state = runtime.getState();
      expect(state.isError).toBe(true);
      if ("error" in state) {
        expect(state.error).toBeInstanceOf(Error);
      }
    });
  });

  /**
   * State Invariants
   */
  describe("state invariants", () => {
    it("currentTime should never exceed duration", async () => {
      await setupState(runtime, videoElement, "Control/Playing");

      const state = runtime.getState();
      if ("currentTime" in state && "duration" in state) {
        expect(state.currentTime).toBeLessThanOrEqual(state.duration);
      }
    });

    it("playback rate should be positive", async () => {
      await setupState(runtime, videoElement, "Control/Playing");

      const state = runtime.getState();
      if ("playbackRate" in state) {
        expect(state.playbackRate).toBeGreaterThan(0);
      }
    });

    it("duration should be positive for loaded media", async () => {
      await setupState(runtime, videoElement, "Control/Playing");

      const state = runtime.getState();
      if ("duration" in state) {
        expect(state.duration).toBeGreaterThan(0);
      }
    });
  });
});

// ============================================================================
// Test Utilities
// ============================================================================

async function setupState(runtime: PlayerRuntime, videoElement: HTMLVideoElement, targetState: string): Promise<void> {
  await runtime.mount(videoElement)();

  switch (targetState) {
    case "Control/Loading":
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      break;

    case "Control/Playing":
      await runtime.dispatch({ _tag: "Intent/LoadRequested", url: "video.mp4" })();
      await runtime.dispatch({
        _tag: "Engine/MetadataLoaded",
        url: "video.mp4",
        duration: 120,
        width: 1920,
        height: 1080,
      })();
      await runtime.dispatch({
        _tag: "Engine/Playing",
        snapshot: createSnapshot({ paused: false, currentTime: 10 }),
      })();
      break;

    case "Control/Paused":
      await setupState(runtime, videoElement, "Control/Playing");
      await runtime.dispatch({
        _tag: "Engine/Paused",
        snapshot: createSnapshot({ paused: true, currentTime: 15 }),
      })();
      break;

    case "Control/Ended":
      await setupState(runtime, videoElement, "Control/Playing");
      await runtime.dispatch({
        _tag: "Engine/Ended",
        snapshot: createSnapshot({ currentTime: 120 }),
      })();
      break;
  }

  await waitForProcessing();
}

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
