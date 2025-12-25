import * as E from "fp-ts/Either";
import type * as IO from "fp-ts/IO";
import type * as TE from "fp-ts/TaskEither";
import { type Mock, vi } from "vitest";
import type { AdapterError, PlaybackType, PlayerEvent, RuntimeAdapter, UnsubscribeFn } from "../types";

export type MockAdapter = RuntimeAdapter & {
  mount: Mock<(videoElement: HTMLVideoElement) => IO.IO<void>>;
  load: Mock<(url: string) => TE.TaskEither<AdapterError, void>>;
  play: Mock<TE.TaskEither<AdapterError, void>>;
  pause: Mock<TE.TaskEither<AdapterError, void>>;
  seek: Mock<(time: number) => TE.TaskEither<AdapterError, void>>;
  setVolume: Mock<(volume: number) => TE.TaskEither<AdapterError, void>>;
  setMuted: Mock<(muted: boolean) => TE.TaskEither<AdapterError, void>>;
  destroy: Mock<TE.TaskEither<AdapterError, void>>;
  subscribe: Mock<(listener: (event: PlayerEvent) => void) => IO.IO<UnsubscribeFn>>;
};

/**
 * Create a mock adapter for testing
 */
export const createMockAdapter = (type: PlaybackType = "native"): MockAdapter => ({
  type,
  name: `Mock ${type} Adapter`,
  mount: vi.fn((_videoElement: HTMLVideoElement) => () => {}),
  load: vi.fn((_url: string) => async () => E.right(undefined)),
  play: vi.fn(async () => E.right(undefined)) as unknown as Mock<TE.TaskEither<AdapterError, void>>,
  pause: vi.fn(async () => E.right(undefined)) as unknown as Mock<TE.TaskEither<AdapterError, void>>,
  seek: vi.fn((_time: number) => async () => E.right(undefined)),
  setVolume: vi.fn((_volume: number) => async () => E.right(undefined)),
  setMuted: vi.fn((_muted: boolean) => async () => E.right(undefined)),
  destroy: vi.fn(async () => E.right(undefined)) as unknown as Mock<TE.TaskEither<AdapterError, void>>,
  subscribe: vi.fn((_listener: (event: PlayerEvent) => void) => () => () => {}),
});

/**
 * Create a mock adapter that simulates errors
 */
export const createFailingMockAdapter = (
  failOn: "mount" | "load" | "play" | "pause" | "seek" | "destroy" = "load",
  type: PlaybackType = "native",
): MockAdapter => {
  const adapter = createMockAdapter(type);

  switch (failOn) {
    case "mount":
      adapter.mount = vi.fn((_videoElement: HTMLVideoElement) => () => {
        throw new Error("Mount failed");
      });
      break;
    case "load":
      adapter.load = vi.fn(
        (_url: string) => async () =>
          E.left({
            _tag: "AdapterError/LoadFailed" as const,
            message: "Load failed",
            url: _url,
          }),
      );
      break;
    case "play":
      adapter.play = vi.fn(async () =>
        E.left({
          _tag: "AdapterError/PlayFailed" as const,
          message: "Play failed",
        }),
      ) as unknown as Mock<TE.TaskEither<AdapterError, void>>;
      break;
    case "pause":
      adapter.pause = vi.fn(async () =>
        E.left({
          _tag: "AdapterError/PauseFailed" as const,
          message: "Pause failed",
        }),
      ) as unknown as Mock<TE.TaskEither<AdapterError, void>>;
      break;
    case "seek":
      adapter.seek = vi.fn(
        (_time: number) => async () =>
          E.left({
            _tag: "AdapterError/SeekFailed" as const,
            message: "Seek failed",
            time: _time,
          }),
      );
      break;
    case "destroy":
      adapter.destroy = vi.fn(async () =>
        E.left({
          _tag: "AdapterError/DestroyFailed" as const,
          message: "Destroy failed",
        }),
      ) as unknown as Mock<TE.TaskEither<AdapterError, void>>;
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
      return E.right(undefined);
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
