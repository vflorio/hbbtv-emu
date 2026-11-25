import * as IO from "fp-ts/IO";
import * as TE from "fp-ts/TaskEither";
import { describe, expect, it, vi } from "vitest";
import type { StreamEventSchedulerApi } from "../../../subsystems";
import type { ChannelVideoStreamEnv } from "./channel";
import { VideoBroadcast, type VideoBroadcastEventHandlers } from "./index";

const createFakeVideoStream = () => {
  const setVolume = vi.fn((_: number) => IO.of(undefined));
  const setMuted = vi.fn((_: boolean) => IO.of(undefined));
  const videoStream: ChannelVideoStreamEnv = {
    videoElement: document.createElement("video"),
    play: TE.right(undefined),
    stop: IO.of(undefined),
    destroy: IO.of(undefined),
    loadSource: () => IO.of(undefined),
    setSize: () => IO.of(undefined),
    setFullscreen: () => IO.of(undefined),
    setVolume,
    setMuted,
    getVolume: IO.of(100),
    onStreamStateChange: () => () => {},
  };
  return { videoStream, setVolume, setMuted };
};

const noopEventHandlers = new Proxy({} as VideoBroadcastEventHandlers, { get: () => () => {} });

const noopStreamEventScheduler: StreamEventSchedulerApi = {
  start: () => IO.of(undefined),
  stop: () => IO.of(undefined),
  updateChannels: () => IO.of(undefined),
  setCurrentChannel: () => IO.of(undefined),
  addListener: () => IO.of({ unsubscribe: IO.of(undefined) }),
} as unknown as StreamEventSchedulerApi;

const setup = () => {
  const stream = createFakeVideoStream();
  const videoBroadcast = new VideoBroadcast({
    channelRegistry: { channels: [] },
    videoStream: stream.videoStream,
    onCurrentChannelChange: () => {},
    streamEventScheduler: noopStreamEventScheduler,
    defaults: { fullScreen: false, width: 1280, height: 720, playState: 0 },
    eventHandlers: noopEventHandlers,
  });
  return { videoBroadcast, ...stream };
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

  it("rejects an out-of-range volume", () => {
    const { videoBroadcast, setVolume } = setup();

    expect(videoBroadcast.setVolume(101)).toBe(false);
    expect(videoBroadcast.getVolume()).toBe(100);
    expect(setVolume).not.toHaveBeenCalled();
  });
});
