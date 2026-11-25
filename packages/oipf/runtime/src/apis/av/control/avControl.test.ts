import { OIPF } from "@hbb-emu/oipf-api";
import { describe, expect, it } from "vitest";
import { VideoStreamPlayState as Stream, type VideoStreamPlayState } from "../../../subsystems";
import type { Size } from "../../dae/videoBroadcast/display";
import { createAVControlVideo, DEFAULT_AV_CONTROL_VIDEO_DEFAULTS } from ".";
import type { AvStream } from "./stream";

const { PlayState } = OIPF.AV.Control;

const setup = () => {
  const calls: string[] = [];
  const handled: unknown[] = [];
  const listeners = new Set<(state: VideoStreamPlayState) => void>();
  const size: { -readonly [K in keyof Size]: Size[K] } = { width: 640, height: 360 };
  const media = { position: undefined as number | undefined, duration: undefined as number | undefined };

  const stream: AvStream = {
    videoElement: document.createElement("video"),
    load: (url) => () => calls.push(`load ${url}`),
    play: () => calls.push("play"),
    pause: () => calls.push("pause"),
    stop: () => calls.push("stop"),
    seek: (position) => () => calls.push(`seek ${position}`),
    getPosition: () => media.position,
    getDuration: () => media.duration,
    onStreamStateChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setVolume: (volume) => () => calls.push(`volume ${volume}`),
    setMuted: (muted) => () => calls.push(`muted ${muted}`),
    destroy: () => calls.push("destroy"),
  };

  const object = createAVControlVideo({
    mimeType: () => "video/mp4",
    stream,
    videoWindow: {
      getSize: () => ({ ...size }),
      setWidth: (width) => () => {
        size.width = width;
      },
      setHeight: (height) => () => {
        size.height = height;
      },
      setFullScreen: (fullScreen) => () => calls.push(`window fullScreen ${fullScreen}`),
    },
    focusObject: () => calls.push("focus"),
    defaults: DEFAULT_AV_CONTROL_VIDEO_DEFAULTS,
    eventHandlers: {
      onPlayStateChange: (state) => handled.push({ onPlayStateChange: state }),
      onPlayPositionChanged: (position) => handled.push({ onPlayPositionChanged: position }),
      onPlaySpeedChanged: (speed) => handled.push({ onPlaySpeedChanged: speed }),
      onFullScreenChange: (fullScreen) => handled.push({ onFullScreenChange: fullScreen }),
    },
  });

  const emit = (state: VideoStreamPlayState) => {
    for (const listener of listeners) listener(state);
  };
  return { object, calls, handled, media, emit, size };
};

describe("A/V Control object (video)", () => {
  it("exposes the OIPF members, and nothing of its parts' internals", () => {
    const { object } = setup();
    expect(Object.keys(object).sort()).toEqual([
      "applyState",
      "data",
      "error",
      "focus",
      "fullScreen",
      "getState",
      "notifyStateChange",
      "play",
      "playPosition",
      "playState",
      "playTime",
      "queue",
      "seek",
      "setFullScreen",
      "setSource",
      "setVolume",
      "speed",
      "stop",
      "subscribe",
      "videoElement",
    ]);
  });

  it("plays its data through its player, and calls the application's handlers", () => {
    const { object, calls, handled, media, emit } = setup();
    object.data = "http://vod/movie.mp4";

    expect(object.play()).toBe(true);
    media.position = 0;
    media.duration = 90_000;
    emit(Stream.paused());
    emit(Stream.playing());

    expect(calls).toEqual(["load http://vod/movie.mp4", "play"]);
    expect(object.playState).toBe(PlayState.PLAYING);
    expect(object.speed).toBe(1);
    expect(object.playTime).toBe(90_000);
    expect(handled).toEqual([
      { onPlayStateChange: PlayState.CONNECTING },
      { onPlaySpeedChanged: 1 },
      { onPlayStateChange: PlayState.PLAYING },
    ]);

    expect(object.seek(1_000)).toBe(true);
    expect(object.playPosition).toBe(1_000);
    expect(handled[handled.length - 1]).toEqual({ onPlayPositionChanged: 1_000 });
  });

  it("getters read the state live (they are accessors on the object, not copied values)", () => {
    const { object } = setup();
    expect(object.playState).toBe(PlayState.STOPPED);
    object.data = "http://vod/movie.mp4";
    object.play(0);
    expect(object.playState).toBe(PlayState.PAUSED);
    expect(object.data).toBe("http://vod/movie.mp4");
  });

  it("setVolume() returns true only if the volume changed", () => {
    const { object, calls } = setup();
    expect(object.setVolume(40)).toBe(true);
    expect(object.setVolume(40)).toBe(false);
    expect(object.setVolume(140)).toBe(false);
    expect(calls).toEqual(["volume 40"]);
  });

  it("setFullScreen() changes the window and reports the change once", () => {
    const { object, calls, handled } = setup();
    object.setFullScreen(true);
    object.setFullScreen(true);
    expect(object.fullScreen).toBe(true);
    expect(calls).toEqual(["window fullScreen true"]);
    expect(handled).toEqual([{ onFullScreenChange: true }]);
  });

  it("focus() focuses the object", () => {
    const { object, calls } = setup();
    object.focus();
    expect(calls).toEqual(["focus"]);
  });

  it("queue() and setSource() are not supported", () => {
    const { object } = setup();
    expect(object.queue("http://vod/next.mp4")).toBe(false);
    expect(object.setSource("rec-1")).toBe(false);
  });

  describe("settings UI state", () => {
    it("reads every key from the parts", () => {
      const { object } = setup();
      object.data = "http://vod/movie.mp4";
      expect(object.getState()).toEqual({
        mimeType: "video/mp4",
        data: "http://vod/movie.mp4",
        playState: PlayState.STOPPED,
        error: undefined,
        speed: 0,
        playPosition: undefined,
        playTime: undefined,
        volume: 100,
        muted: false,
        fullScreen: false,
        width: 640,
        height: 360,
        components: [],
        selectedComponents: {},
      });
    });

    it("applies through the same rules as the application; read-only keys are ignored", () => {
      const { object, calls, size } = setup();
      object.applyState({
        mimeType: "audio/mp4",
        data: "http://vod/movie.mp4",
        volume: 20,
        muted: true,
        width: 1280,
        playTime: 5,
        fullScreen: true,
      })();

      const state = object.getState();
      expect(state).toMatchObject({ mimeType: "video/mp4", data: "http://vod/movie.mp4", volume: 20, muted: true });
      expect(state.playTime).toBeUndefined();
      expect(size.width).toBe(1280);
      expect(calls).toEqual(["volume 20", "muted true", "window fullScreen true"]);
    });

    it("a play position from the UI seeks", () => {
      const { object, calls, media, emit } = setup();
      object.data = "http://vod/movie.mp4";
      object.play(1);
      media.position = 0;
      media.duration = 60_000;
      emit(Stream.paused());
      object.applyState({ playPosition: 15_000 })();
      expect(calls).toContain("seek 15000");
      expect(object.playPosition).toBe(15_000);
    });
  });
});
