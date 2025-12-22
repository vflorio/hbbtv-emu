import type * as IO from "fp-ts/IO";
import type * as T from "fp-ts/Task";
import { type Mock, vi } from "vitest";
import type { PlayerEvent, UnsubscribeFn } from "../types";

export type MockAdapter = {
  readonly type: string;
  readonly name: string;
  mount: Mock<() => IO.IO<void>>;
  load: Mock<(url: string) => T.Task<void>>;
  play: Mock<() => T.Task<void>>;
  pause: Mock<() => T.Task<void>>;
  seek: Mock<(time: number) => T.Task<void>>;
  destroy: Mock<() => T.Task<void>>;
  subscribe: Mock<(listener: (event: PlayerEvent) => void) => IO.IO<UnsubscribeFn>>;
};

/**
 * Create a mock adapter for testing
 */
export const createMockAdapter = (): MockAdapter => ({
  type: "native",
  name: "Mock Native Adapter",
  mount: vi.fn(() => () => {}),
  load: vi.fn(() => async () => {}),
  play: vi.fn(() => async () => {}),
  pause: vi.fn(() => async () => {}),
  seek: vi.fn(() => async () => {}),
  destroy: vi.fn(() => async () => {}),
  subscribe: vi.fn(() => () => () => {}),
});

/**
 * Create a mock adapter that simulates errors
 */
export const createFailingMockAdapter = (
  failOn: "mount" | "load" | "play" | "pause" | "seek" | "destroy" = "load",
): MockAdapter => {
  const adapter = createMockAdapter();

  switch (failOn) {
    case "mount":
      adapter.mount = vi.fn(() => () => {
        throw new Error("Mount failed");
      });
      break;
    case "load":
      adapter.load = vi.fn(() => async () => {
        throw new Error("Load failed");
      });
      break;
    case "play":
      adapter.play = vi.fn(() => async () => {
        throw new Error("Play failed");
      });
      break;
    case "pause":
      adapter.pause = vi.fn(() => async () => {
        throw new Error("Pause failed");
      });
      break;
    case "seek":
      adapter.seek = vi.fn(() => async () => {
        throw new Error("Seek failed");
      });
      break;
    case "destroy":
      adapter.destroy = vi.fn(() => async () => {
        throw new Error("Destroy failed");
      });
      break;
  }

  return adapter;
};

/**
 * Create a mock adapter that emits events
 */
export const createEventEmittingMockAdapter = (
  events: PlayerEvent[] = [],
): MockAdapter & { emitEvent: (event: PlayerEvent) => void } => {
  const adapter = createMockAdapter();
  let eventListener: ((event: PlayerEvent) => void) | null = null;

  adapter.subscribe = vi.fn((listener) => () => {
    eventListener = listener;
    return () => {
      eventListener = null;
    };
  });

  const emitEvent = (event: PlayerEvent) => {
    if (eventListener) {
      eventListener(event);
    }
  };

  // Auto-emit initial events
  if (events.length > 0) {
    adapter.load = vi.fn(() => async () => {
      events.forEach((event) => emitEvent(event));
    });
  }

  return {
    ...adapter,
    emitEvent,
  };
};

/**
 * Wait for async operations to complete
 */
export const waitForAsync = (ms = 50): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a mock video element
 */
export const createMockVideoElement = (): HTMLVideoElement => {
  const video = document.createElement("video") as HTMLVideoElement;

  // Add additional properties if needed
  Object.defineProperties(video, {
    currentTime: { writable: true, value: 0 },
    duration: { writable: true, value: 0 },
    paused: { writable: true, value: true },
    videoWidth: { writable: true, value: 1920 },
    videoHeight: { writable: true, value: 1080 },
  });

  return video;
};
