import { proxyProperties } from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf-api";
import * as IO from "fp-ts/IO";
import * as TE from "fp-ts/TaskEither";
import { describe, expect, it, type Mock, vi } from "vitest";
import { type StreamEventSchedulerApi, tuneAlone } from "../../../subsystems";
import { FULLSCREEN_ATTRIBUTE } from "../../../subsystems/provider/detection/embedded";
import type { ChannelVideoStreamEnv } from "./channel";
import { createVideoBroadcast, type VideoBroadcastEventHandlers } from "./index";
import { createObjectVideoWindow } from "./videoWindow";

const createFakeVideoStream = () => {
  const setVolume = vi.fn((_: number) => IO.of(undefined));
  const setMuted = vi.fn((_: boolean) => IO.of(undefined));
  const videoStream: ChannelVideoStreamEnv = {
    videoElement: document.createElement("video"),
    play: TE.right(undefined),
    stop: IO.of(undefined),
    destroy: IO.of(undefined),
    loadSource: () => IO.of(undefined),
    setVolume,
    setMuted,
    getVolume: IO.of(100),
    onStreamStateChange: () => () => {},
  };
  return { videoStream, setVolume, setMuted };
};

type HandlerSpy = Mock<(...args: unknown[]) => void>;

/** Every handler is a spy, created on first access. */
const createEventHandlers = () => {
  const spies = new Map<PropertyKey, HandlerSpy>();
  return new Proxy({} as { [K in keyof VideoBroadcastEventHandlers]: HandlerSpy }, {
    get: (_, key) => {
      if (!spies.has(key)) spies.set(key, vi.fn<(...args: unknown[]) => void>());
      return spies.get(key);
    },
  });
};

const noopStreamEventScheduler: StreamEventSchedulerApi = {
  start: () => IO.of(undefined),
  stop: () => IO.of(undefined),
  updateChannels: () => IO.of(undefined),
  setCurrentChannel: () => IO.of(undefined),
  addListener: () => IO.of({ unsubscribe: IO.of(undefined) }),
} as unknown as StreamEventSchedulerApi;

const { PlayState } = OIPF.DAE.Broadcast;

const setup = (objectStyle = "width: 1280px; height: 720px", playState: OIPF.DAE.Broadcast.PlayState = 0) => {
  const stream = createFakeVideoStream();
  const eventHandlers = createEventHandlers();
  const object = document.createElement("object");
  object.setAttribute("type", "video/broadcast");
  object.setAttribute("style", objectStyle);
  object.appendChild(stream.videoStream.videoElement);
  document.body.appendChild(object);
  const videoBroadcast = createVideoBroadcast({
    channelRegistry: { getChannels: () => [] },
    videoStream: stream.videoStream,
    audioOutput: { setVolume: stream.setVolume, setMuted: stream.setMuted },
    videoWindow: createObjectVideoWindow(object, stream.videoStream.videoElement),
    getTunedChannel: () => null,
    requestChannelChange: tuneAlone,
    onCurrentChannelChange: () => {},
    streamEventScheduler: noopStreamEventScheduler,
    defaults: { fullScreen: false, playState },
    eventHandlers,
  });
  return { videoBroadcast, eventHandlers, object, video: stream.videoStream.videoElement, ...stream };
};

describe("VideoBroadcast — volume", () => {
  it("starts at full volume, not muted", () => {
    const { videoBroadcast } = setup();

    expect(videoBroadcast.getVolume()).toBe(100);
    expect(videoBroadcast.getState()).toMatchObject({ volume: 100, muted: false });
  });

  it("setVolume() is reflected by getVolume(), by the synced state and by the player", () => {
    const { videoBroadcast, setVolume } = setup();

    expect(videoBroadcast.setVolume(30)).toBe(true);

    expect(videoBroadcast.getVolume()).toBe(30);
    expect(videoBroadcast.getState()).toMatchObject({ volume: 30 });
    expect(setVolume).toHaveBeenCalledWith(30);
  });

  it("applyState() from the settings UI drives volume and mute on the player", () => {
    const { videoBroadcast, setVolume, setMuted } = setup();

    videoBroadcast.applyState({ volume: 10, muted: true })();

    expect(videoBroadcast.getVolume()).toBe(10);
    expect(setVolume).toHaveBeenCalledWith(10);
    expect(setMuted).toHaveBeenCalledWith(true);
  });

  it("release(): the application's volume ceases to have effect, the settings UI's mute stays (TS 102 796 §10.2.12)", () => {
    const { videoBroadcast, setVolume, setMuted, eventHandlers } = setup(undefined, PlayState.PRESENTING);
    videoBroadcast.setVolume(86);
    videoBroadcast.applyState({ muted: true })();
    let heard: number | undefined;
    eventHandlers.onPlayStateChange.mockImplementation(() => {
      heard = videoBroadcast.getVolume();
    });

    videoBroadcast.release();

    expect(videoBroadcast.getVolume()).toBe(100);
    expect(heard).toBe(100);
    expect(setVolume).toHaveBeenLastCalledWith(100);
    expect(videoBroadcast.getState()).toMatchObject({ volume: 100, muted: true });
    expect(setMuted).toHaveBeenCalledTimes(1);
  });

  it("set while unrealized, the volume holds until the object enters the unrealized state again", () => {
    const { videoBroadcast } = setup();
    videoBroadcast.setVolume(50);

    // The TV presents nothing: the object stays unrealized, it does not enter it.
    videoBroadcast.bindToCurrentChannel();

    expect(videoBroadcast.getVolume()).toBe(50);
  });

  it("rejects an out-of-range volume", () => {
    const { videoBroadcast, setVolume } = setup();

    expect(videoBroadcast.setVolume(101)).toBe(false);
    expect(videoBroadcast.getVolume()).toBe(100);
    expect(setVolume).not.toHaveBeenCalled();
  });
});

describe("VideoBroadcast — display", () => {
  it("reports the size of the <object> and starts windowed", () => {
    const { videoBroadcast } = setup("width: 640px; height: 360px");

    expect(videoBroadcast.getState()).toMatchObject({ fullScreen: false, width: 640, height: 360 });
  });

  it("setFullScreen() switches the video and notifies the application", () => {
    const { videoBroadcast, video, eventHandlers } = setup();

    videoBroadcast.setFullScreen(true);

    expect(videoBroadcast.fullScreen).toBe(true);
    expect(videoBroadcast.getState()).toMatchObject({ fullScreen: true });
    expect(video.hasAttribute(FULLSCREEN_ATTRIBUTE)).toBe(true);
    expect(eventHandlers.onFullScreenChange).toHaveBeenCalledWith(true);
  });

  it("applyState() from the settings UI enters full-screen and notifies the application", () => {
    const { videoBroadcast, video, eventHandlers } = setup();

    videoBroadcast.applyState({ fullScreen: true })();

    expect(videoBroadcast.fullScreen).toBe(true);
    expect(video.hasAttribute(FULLSCREEN_ATTRIBUTE)).toBe(true);
    expect(eventHandlers.onFullScreenChange).toHaveBeenCalledWith(true);
  });

  it("width and height set the object's style, only while windowed", () => {
    const { videoBroadcast, object } = setup();

    videoBroadcast.width = 640;
    expect(object.style.width).toBe("640px");

    videoBroadcast.setFullScreen(true);
    videoBroadcast.height = 100;
    expect(object.style.height).toBe("720px");
    expect(videoBroadcast.height).toBe(720);

    videoBroadcast.setFullScreen(false);
    expect(videoBroadcast.getState()).toMatchObject({ fullScreen: false, width: 640, height: 720 });
  });

  it("applyState() from the settings UI resizes the object", () => {
    const { videoBroadcast, object } = setup();

    videoBroadcast.applyState({ width: 320, height: 180 })();

    expect(object.style.width).toBe("320px");
    expect(object.style.height).toBe("180px");
  });
});

describe("VideoBroadcast — one object composed of its parts", () => {
  it("has every part's members, accessors read live", () => {
    const { videoBroadcast } = setup();

    expect(videoBroadcast.COMPONENT_TYPE_AUDIO).toBe(1);
    expect(videoBroadcast.data).toBe("");
    expect(typeof videoBroadcast.setChannel).toBe("function");
    expect(typeof videoBroadcast.addStreamEventListener).toBe("function");
    expect(videoBroadcast.fullScreen).toBe(false);

    videoBroadcast.setFullScreen(true);

    expect(videoBroadcast.fullScreen).toBe(true);
  });

  it("exposed on its <object>, the accessors stay live and the handlers the application sets reach it", () => {
    const { videoBroadcast, object } = setup();
    const element = object as HTMLObjectElement & Record<string, unknown>;
    proxyProperties(element, videoBroadcast, ["width", "height"])();
    const onProgrammesChanged = () => {};

    videoBroadcast.setFullScreen(true);
    element.onProgrammesChanged = onProgrammesChanged;

    expect(element.fullScreen).toBe(true);
    expect(element.width).toBe(1280);
    expect(videoBroadcast.onProgrammesChanged).toBe(onProgrammesChanged);
  });

  it("the settings UI reads the application's stream event subscriptions, and cannot write them", () => {
    const { videoBroadcast } = setup();
    videoBroadcast.addStreamEventListener("dvb://1", "now", () => {});

    videoBroadcast.applyState({ streamEventListeners: [] })();

    expect(videoBroadcast.getState()).toMatchObject({
      streamEventListeners: [{ targetURL: "dvb://1", eventName: "now" }],
    });
  });

  it("the settings UI's programmes and components read back as written", () => {
    const { videoBroadcast } = setup();

    videoBroadcast.applyState({ programmes: [], components: [], selectedComponents: {} })();

    expect(videoBroadcast.getState()).toMatchObject({ programmes: [], components: [], selectedComponents: {} });
  });
});
