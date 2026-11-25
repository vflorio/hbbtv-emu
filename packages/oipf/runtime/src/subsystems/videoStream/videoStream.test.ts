import { type PlayerRuntime, PlayerState } from "@hbb-emu/player-runtime";
import { describe, expect, it } from "vitest";
import { isStateChangeEvent } from "./events";
import { VideoStreamService } from "./videoStream";

const setup = () => {
  const video = document.createElement("video");
  return { video, stream: new VideoStreamService(video) };
};

describe("VideoStreamService — display", () => {
  it("setFullscreen(true) stretches the video to its container", () => {
    const { video, stream } = setup();

    stream.setFullscreen(true)();

    expect(video.style.width).toBe("100%");
    expect(video.style.height).toBe("100%");
  });

  it("setFullscreen(false) drops the full-screen styling", () => {
    const { video, stream } = setup();
    stream.setFullscreen(true)();

    stream.setFullscreen(false)();

    expect(video.getAttribute("style")).toBeNull();
  });

  it("setSize() sets the size in pixels", () => {
    const { video, stream } = setup();

    stream.setSize(640, 360)();

    expect(video.style.width).toBe("640px");
    expect(video.style.height).toBe("360px");
  });

  it("is lazy: nothing changes until the IO is run", () => {
    const { video, stream } = setup();

    const enter = stream.setFullscreen(true);
    const resize = stream.setSize(640, 360);

    expect(video.getAttribute("style")).toBeNull();
    resize();
    enter();
    expect(video.style.width).toBe("100%");
  });
});

describe("VideoStreamService — following the player", () => {
  /** A player runtime whose state the test pushes; `subscribeToState` is an IO, as the real one. */
  const fakeRuntime = () => {
    const listeners = new Set<(state: PlayerState.Any) => void>();
    const runtime = {
      mount: () => () => undefined,
      subscribeToState: (listener: (state: PlayerState.Any) => void) => () => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      subscribeToEvents: () => () => () => undefined,
    } as unknown as PlayerRuntime;
    return { runtime, listeners, push: (state: PlayerState.Any) => listeners.forEach((listener) => listener(state)) };
  };

  it("subscribes to the runtime's state and reports its play state changes", () => {
    const { runtime, listeners, push } = fakeRuntime();
    const stream = new VideoStreamService(document.createElement("video"), runtime);
    const states: string[] = [];
    stream.subscribe((event) => {
      if (isStateChangeEvent(event)) states.push(event.state._tag);
    })();

    expect(listeners.size).toBe(1);
    push(new PlayerState.Control.Paused(0, 3, []));
    push(new PlayerState.Control.Playing(0, 3, [], 1));
    expect(states).toEqual(["Paused", "Playing"]);
  });

  it("stops following the runtime when released", () => {
    const { runtime, listeners } = fakeRuntime();
    const stream = new VideoStreamService(document.createElement("video"), runtime);
    stream.release()();
    expect(listeners.size).toBe(0);
  });
});
