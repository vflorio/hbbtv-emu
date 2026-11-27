import { afterEach, describe, expect, it } from "vitest";
import {
  alphaOf,
  BROADCAST_LAYER_ATTRIBUTE,
  type BroadcastLayer,
  type BroadcastStream,
  coversVideoPlane,
  createBroadcastLayer,
  createSourceLoader,
} from "./broadcastLayer";
import { createTvVolume } from "./tvVolume";
import { VideoStreamPlayState as Stream, type VideoStreamPlayState } from "./videoStream";

/** MutationObserver callbacks are microtasks; the background check waits for a frame. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 50));

type Call = { readonly load: string } | { readonly play: true } | { readonly stop: true } | { readonly seek: number };

/** Some real time: 1 000 000 s since the Unix epoch, when the channel's time started. */
const NOW_MS = 1_000_000_000;

const setup = () => {
  const calls: Call[] = [];
  const clock = { now: NOW_MS };
  const listeners = new Set<(state: VideoStreamPlayState) => void>();
  const video = document.createElement("video");
  // jsdom plays nothing: the video is playing unless a test says the browser paused it.
  const media = { paused: false };
  Object.defineProperty(video, "paused", { get: () => media.paused });
  // A live stream unless a test gives it a duration. Setting the position is a seek, which
  // lands at once unless a test says it is still seeking, or stuck.
  const timeline = {
    duration: Number.POSITIVE_INFINITY,
    currentTime: 0,
    seeking: false,
    stuck: false,
    /** How far the element can seek (a server without byte ranges: what it has); all of it by default. */
    seekableEnd: null as number | null,
  };
  Object.defineProperty(video, "duration", { get: () => timeline.duration });
  Object.defineProperty(video, "seekable", {
    get: () => ({ length: 1, start: () => 0, end: () => timeline.seekableEnd ?? timeline.duration }),
  });
  Object.defineProperty(video, "seeking", { get: () => timeline.seeking });
  Object.defineProperty(video, "currentTime", {
    get: () => timeline.currentTime,
    set: (position: number) => {
      calls.push({ seek: position });
      if (!timeline.stuck) timeline.currentTime = position;
    },
  });
  const stream: BroadcastStream = {
    videoElement: video,
    load: (url) => () => {
      calls.push({ load: url });
    },
    play: () => {
      calls.push({ play: true });
    },
    stop: () => {
      calls.push({ stop: true });
    },
    setMuted: () => () => {},
    onStateChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const tvVolume = createTvVolume();
  const layer = createBroadcastLayer({
    document,
    stream,
    tvVolume,
    gain: (volume) => volume / 100,
    now: () => clock.now,
  });
  layer.mount();
  mounted.push(layer);
  /** The stream changes state, as the player reports it. */
  const emit = (state: VideoStreamPlayState) => {
    for (const listener of [...listeners]) listener(state);
  };
  return { layer, calls, video, emit, tvVolume, media, timeline, clock };
};

const mounted: BroadcastLayer[] = [];

const addObject = () => {
  const object = document.createElement("object");
  object.setAttribute("type", "video/broadcast");
  document.body.appendChild(object);
  return object;
};

const host = () => document.querySelector(`[${BROADCAST_LAYER_ATTRIBUTE}]`) as HTMLElement | null;

afterEach(() => {
  for (const layer of mounted.splice(0)) layer.unmount();
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
});

describe("the page background (coversVideoPlane)", () => {
  it.each([
    ["transparent", 0],
    ["", 0],
    ["rgba(0, 0, 0, 0)", 0],
    ["rgba(10, 20, 30, 0.5)", 0.5],
    ["rgb(0 0 0 / 0.25)", 0.25],
    ["rgb(255, 255, 255)", 1],
  ])("%j has alpha %d", (color, alpha) => {
    expect(alphaOf(color)).toBe(alpha);
  });

  const none = { backgroundColor: "rgba(0, 0, 0, 0)", backgroundImage: "none" };

  it("a transparent root and body show the video plane", () => {
    expect(coversVideoPlane(none, none)).toBe(false);
    expect(coversVideoPlane(none, null)).toBe(false);
  });

  it("a colour or an image on the root or on the body hides it (CSS 2.1 §14.2)", () => {
    expect(coversVideoPlane({ ...none, backgroundColor: "rgb(0, 0, 0)" }, none)).toBe(true);
    expect(coversVideoPlane(none, { ...none, backgroundImage: 'url("bg.png")' })).toBe(true);
  });
});

describe("the TV presents the broadcast (OIPF DAE Annex H.1)", () => {
  it("behind everything the page draws, over the whole viewport, out of the application's queries", () => {
    const { video } = setup();

    const layer = host();
    expect(layer?.parentElement).toBe(document.documentElement);
    expect(layer?.style.getPropertyValue("position")).toBe("fixed");
    expect(layer?.style.getPropertyValue("z-index")).toBe("-2147483648");
    expect(layer?.shadowRoot?.contains(video)).toBe(true);
    expect(document.querySelector("video")).toBeNull();
  });

  it("loads the channel the TV is tuned to, once, and stops with no channel", () => {
    const { layer, calls } = setup();

    layer.tune("http://tv/dmax.mpd")();
    layer.tune("http://tv/dmax.mpd")();
    layer.tune("http://tv/hgtv.mpd")();
    layer.tune(null)();

    expect(calls).toEqual([{ load: "http://tv/dmax.mpd" }, { load: "http://tv/hgtv.mpd" }, { stop: true }]);
  });

  it("is hidden where the application's background paints, which hides the video plane on a TV", async () => {
    setup();
    await flush();
    expect(host()?.style.getPropertyValue("display")).toBe("block");

    document.body.style.backgroundColor = "rgb(0, 0, 0)";
    await flush();
    expect(host()?.style.getPropertyValue("display")).toBe("none");

    document.body.style.backgroundColor = "transparent";
    await flush();
    expect(host()?.style.getPropertyValue("display")).toBe("block");
  });

  it("goes back in the document if the page removes it", async () => {
    setup();

    host()?.remove();
    await flush();

    expect(host()?.parentElement).toBe(document.documentElement);
  });
});

describe("a video/broadcast object controls it (OIPF DAE Annex H.2)", () => {
  it("binding takes what the TV presents as it is: no new load, the video inside the object", () => {
    const { layer, calls, video } = setup();
    const object = addObject();
    const control = layer.control(object);

    expect(control.bind()).toBe(false);
    layer.tune("http://tv/dmax.mpd")();
    expect(control.bind()).toBe(true);

    expect(calls).toEqual([{ load: "http://tv/dmax.mpd" }]);
    expect(video.parentNode).toBe(object);
  });

  it("only the controlling object hears the stream, and not its start-up before it first presents", () => {
    const { layer, emit, clock } = setup();
    const heard: string[] = [];
    const other: string[] = [];
    const control = layer.control(addObject());
    control.onStreamStateChange((state) => heard.push(state._tag));
    layer.control(addObject()).onStreamStateChange((state) => other.push(state._tag));
    layer.tune("http://tv/dmax.mpd")();
    control.bind();

    emit(Stream.buffering());
    emit(Stream.playing());
    clock.now += 2_000;
    emit(Stream.buffering());

    // The TV was presenting before the application started: its start-up is the emulator's.
    expect(heard).toEqual(["Playing", "Buffering"]);
    expect(other).toEqual([]);
  });

  it("presenting what is already presented loads nothing and tells the object it presents", () => {
    const { layer, calls, emit } = setup();
    layer.tune("http://tv/dmax.mpd")();
    emit(Stream.playing());
    const heard: string[] = [];
    const control = layer.control(addObject());
    control.onStreamStateChange((state) => heard.push(state._tag));

    control.present("http://tv/dmax.mpd")();
    control.present("http://tv/hgtv.mpd")();

    expect(heard).toEqual(["Playing"]);
    expect(calls).toEqual([{ load: "http://tv/dmax.mpd" }, { load: "http://tv/hgtv.mpd" }]);
  });

  it("released, gives the video back to the TV, which goes on without loading again", () => {
    const { layer, calls, video } = setup();
    const control = layer.control(addObject());
    layer.tune("http://tv/dmax.mpd")();
    control.bind();

    control.release();

    expect(calls).toEqual([{ load: "http://tv/dmax.mpd" }]);
    expect(host()?.shadowRoot?.contains(video)).toBe(true);
    expect(video.style.visibility).toBe("");
  });

  it("stopped, shows no video and hears no more of the stream; released, the TV presents its channel again", () => {
    const { layer, calls, video, emit } = setup();
    const heard: string[] = [];
    const control = layer.control(addObject());
    control.onStreamStateChange((state) => heard.push(state._tag));
    layer.tune("http://tv/dmax.mpd")();
    control.bind();
    emit(Stream.playing());

    control.stop();
    emit(Stream.paused());

    expect(video.style.visibility).toBe("hidden");
    expect(heard).toEqual(["Playing"]);
    control.release();
    expect(calls).toEqual([{ load: "http://tv/dmax.mpd" }, { stop: true }, { load: "http://tv/dmax.mpd" }]);
    expect(video.style.visibility).toBe("");
  });

  it("an object out of the document shows nothing until it is inserted, and the stream stays in the document", async () => {
    const { layer, video } = setup();
    const object = document.createElement("object");
    const control = layer.control(object);
    layer.tune("http://tv/dmax.mpd")();

    control.bind();

    expect(video.isConnected).toBe(true);
    expect(video.style.visibility).toBe("hidden");
    document.body.appendChild(object);
    await flush();
    expect(video.parentNode).toBe(object);
    expect(video.style.visibility).toBe("");

    object.remove();
    await flush();
    expect(video.isConnected).toBe(true);
  });

  it("a video the browser paused when its object left the document plays on", async () => {
    const { layer, calls, media, emit } = setup();
    const object = addObject();
    const control = layer.control(object);
    layer.tune("http://tv/dmax.mpd")();
    control.bind();
    emit(Stream.playing());

    object.remove();
    media.paused = true;
    await flush();

    expect(calls).toEqual([{ load: "http://tv/dmax.mpd" }, { play: true }]);
  });

  it("the object's volume is in series with the TV's while it controls the broadcast (TS 102 796 §10.2.12)", () => {
    const { layer, video, tvVolume } = setup();
    const control = layer.control(addObject());
    layer.tune("http://tv/dmax.mpd")();
    tvVolume.set(90)();

    control.setVolume(50)();
    expect(video.volume).toBe(0.9);
    control.bind();
    expect(video.volume).toBeCloseTo(0.45);
    tvVolume.set(80)();
    expect(video.volume).toBeCloseTo(0.4);

    control.release();
    expect(video.volume).toBe(0.8);
  });
});

describe("the broadcast is on air before the page loads (a simulated live)", () => {
  /** A bound object, and what it hears. */
  const bound = (layer: BroadcastLayer) => {
    const heard: string[] = [];
    const control = layer.control(addObject());
    control.onStreamStateChange((state) => heard.push(state._tag));
    return { control, heard };
  };

  it("a looping stream goes where the channel is on air once its metadata is loaded, before its first frame", () => {
    const { layer, calls, emit, timeline, video } = setup();
    const { control, heard } = bound(layer);
    layer.tune("http://tv/loop.mp4")();
    control.bind();
    // 1 000 000 s since the channel's time started, a 3 s loop: 1 s into it.
    timeline.duration = 3;

    video.dispatchEvent(new Event("loadedmetadata"));
    emit(Stream.buffering());
    emit(Stream.playing());

    expect(calls).toEqual([{ load: "http://tv/loop.mp4" }, { seek: expect.closeTo(1) }]);
    expect(video.currentTime).toBeCloseTo(1);
    // Part of the start-up: the object hears the stream from when it is there.
    expect(heard).toEqual(["Playing"]);
  });

  it("its start-up lasts until the stream is there: what the player reports while it seeks is not heard", () => {
    const { layer, emit, timeline, video } = setup();
    const { control, heard } = bound(layer);
    layer.tune("http://tv/loop.mp4")();
    control.bind();
    timeline.duration = 3;
    timeline.seeking = true;

    video.dispatchEvent(new Event("loadedmetadata"));
    emit(Stream.paused());
    emit(Stream.playing());
    expect(heard).toEqual([]);
    timeline.seeking = false;
    emit(Stream.playing());

    expect(heard).toEqual(["Playing"]);
  });

  it("waits until it can seek there: a browser without byte ranges seeks only within what it has", () => {
    const { layer, calls, emit, timeline, video } = setup();
    const { control, heard } = bound(layer);
    layer.tune("moz-extension://emu/broadcast/test-card.mp4")();
    control.bind();
    timeline.duration = 3;
    timeline.seekableEnd = 0.5;

    video.dispatchEvent(new Event("loadedmetadata"));
    emit(Stream.playing());
    expect(calls).toEqual([{ load: "moz-extension://emu/broadcast/test-card.mp4" }]);
    expect(heard).toEqual([]);

    timeline.seekableEnd = 3;
    video.dispatchEvent(new Event("progress"));
    emit(Stream.playing());

    expect(calls).toEqual([{ load: "moz-extension://emu/broadcast/test-card.mp4" }, { seek: expect.closeTo(1) }]);
    expect(heard).toEqual(["Playing"]);
  });

  it("joins at the first frame if the player reports it before the layer heard of the metadata", () => {
    const { layer, calls, emit, timeline } = setup();
    layer.tune("http://tv/loop.mp4")();
    timeline.duration = 3;

    emit(Stream.paused());

    expect(calls).toEqual([{ load: "http://tv/loop.mp4" }, { seek: expect.closeTo(1) }]);
  });

  it("a seek that never gets there ends the start-up after a while", () => {
    const { layer, calls, emit, timeline, clock, video } = setup();
    const { control, heard } = bound(layer);
    clock.now += 2_000;
    layer.tune("http://tv/loop.mp4")();
    control.bind();
    // A 10 s loop, 2 s in; the stream stays at its start.
    timeline.duration = 10;
    timeline.stuck = true;

    video.dispatchEvent(new Event("loadedmetadata"));
    emit(Stream.playing());
    clock.now += 3_000;
    emit(Stream.playing());
    expect(heard).toEqual([]);
    clock.now += 2_000;
    emit(Stream.playing());

    expect(calls).toEqual([{ load: "http://tv/loop.mp4" }, { seek: 2 }]);
    expect(heard).toEqual(["Playing"]);
  });

  it("a stream half a second off is sent there too: a TV shows the broadcast where it is", () => {
    const { layer, calls, timeline, video } = setup();
    timeline.duration = 3;
    timeline.currentTime = 0.4;
    layer.tune("http://tv/loop.mp4")();

    video.dispatchEvent(new Event("loadedmetadata"));

    expect(calls).toEqual([{ load: "http://tv/loop.mp4" }, { seek: expect.closeTo(1) }]);
  });

  it("a stream already where the channel is, or a live one, is not sent anywhere", () => {
    const { layer, calls, emit, timeline, video } = setup();
    layer.tune("http://tv/live.mpd")();
    video.dispatchEvent(new Event("loadedmetadata"));
    emit(Stream.playing());

    timeline.duration = 3;
    timeline.currentTime = 0.9;
    layer.tune("http://tv/loop.mp4")();
    video.dispatchEvent(new Event("loadedmetadata"));
    emit(Stream.playing());

    expect(calls).toEqual([{ load: "http://tv/live.mpd" }, { load: "http://tv/loop.mp4" }]);
  });

  it("joins again at every load: after a stop, the TV presents its channel where it is on air", () => {
    const { layer, calls, emit, timeline, clock, video } = setup();
    const { control } = bound(layer);
    timeline.duration = 10;
    clock.now += 2_000;
    layer.tune("http://tv/loop.mp4")();
    control.bind();
    video.dispatchEvent(new Event("loadedmetadata"));
    emit(Stream.playing());

    control.stop();
    clock.now += 4_000;
    control.release();
    video.dispatchEvent(new Event("loadedmetadata"));

    expect(calls).toEqual([
      { load: "http://tv/loop.mp4" },
      { seek: 2 },
      { stop: true },
      { load: "http://tv/loop.mp4" },
      { seek: 6 },
    ]);
  });

  it("the start-up settles a moment after the first frame: a stall then is not heard, nor its end", () => {
    const { layer, emit, clock } = setup();
    const { control, heard } = bound(layer);
    layer.tune("http://tv/loop.mp4")();
    control.bind();

    emit(Stream.playing());
    clock.now += 120;
    // Sent ahead of what it has downloaded, the stream stalls a moment.
    emit(Stream.buffering());
    emit(Stream.playing());
    clock.now += 2_000;
    emit(Stream.buffering());

    expect(heard).toEqual(["Playing", "Buffering"]);
  });

  it("the loop going round is no event of the broadcast: the object hears nothing of it", () => {
    const { layer, emit, timeline, video, clock } = setup();
    const { control, heard } = bound(layer);
    timeline.duration = 3;
    timeline.currentTime = 1;
    layer.tune("http://tv/loop.mp4")();
    control.bind();
    emit(Stream.playing());
    clock.now += 2_000;

    // The element seeks back to its start by itself, and may wait for data (Chromium does).
    video.dispatchEvent(new Event("seeking"));
    emit(Stream.buffering());
    emit(Stream.playing());
    // Afterwards, a buffering is the stream's own again.
    emit(Stream.buffering());

    expect(heard).toEqual(["Playing", "Buffering"]);
  });
});

describe("a file the emulator ships, before the host says where it is (no bootstrap)", () => {
  it("is on air: an object binds to it, and the stream loads once the host gives its URL", () => {
    const { layer, calls, emit } = setup();
    const heard: string[] = [];
    const control = layer.control(addObject());
    control.onStreamStateChange((state) => heard.push(state._tag));

    layer.tune("hbbtv-emu:broadcast/test-card.mp4")();
    expect(control.bind()).toBe(true);
    expect(calls).toEqual([]);

    layer.tune("chrome-extension://emu/broadcast/test-card.mp4")();
    emit(Stream.connecting());
    emit(Stream.playing());

    expect(calls).toEqual([{ load: "chrome-extension://emu/broadcast/test-card.mp4" }]);
    // Its start-up is the emulator's: the object hears it from when it presents.
    expect(heard).toEqual(["Playing"]);
  });

  it("stops a stream the page was presenting", () => {
    const { layer, calls } = setup();
    layer.tune("http://tv/dmax.mpd")();

    layer.tune("hbbtv-emu:broadcast/test-card.mp4")();

    expect(calls).toEqual([{ load: "http://tv/dmax.mpd" }, { stop: true }]);
  });
});

describe("the broadcast's sources (createSourceLoader)", () => {
  const loader = (fetchBlob: (url: string) => Promise<Blob>) => {
    const loaded: string[] = [];
    const revoked: string[] = [];
    let objects = 0;
    const load = createSourceLoader({
      loadUrl: (url) => loaded.push(url),
      fetchBlob,
      createObjectURL: () => `blob:emu/${++objects}`,
      revokeObjectURL: (url) => revoked.push(url),
    });
    return { load, loaded, revoked };
  };

  it("reads a file the extension ships whole and presents it from memory (Firefox serves it without byte ranges)", async () => {
    const fetched: string[] = [];
    const { load, loaded, revoked } = loader(async (url) => {
      fetched.push(url);
      return new Blob(["card"]);
    });

    load("moz-extension://emu/broadcast/test-card.mp4");
    await flush();
    load("moz-extension://emu/broadcast/test-card.mp4");
    await flush();
    load("https://cdn.example/live.mpd");

    expect(fetched).toEqual([
      "moz-extension://emu/broadcast/test-card.mp4",
      "moz-extension://emu/broadcast/test-card.mp4",
    ]);
    expect(loaded).toEqual(["blob:emu/1", "blob:emu/2", "https://cdn.example/live.mpd"]);
    // Each object URL goes once another source replaces it.
    expect(revoked).toEqual(["blob:emu/1", "blob:emu/2"]);
  });

  it("loads a file it cannot read as it is, and the last load wins over one still reading", async () => {
    const failing = loader(() => Promise.reject(new Error("no")));
    failing.load("chrome-extension://emu/broadcast/test-card.mp4");
    await flush();
    expect(failing.loaded).toEqual(["chrome-extension://emu/broadcast/test-card.mp4"]);

    const slow = loader(() => new Promise((resolve) => setTimeout(() => resolve(new Blob(["card"])), 20)));
    slow.load("chrome-extension://emu/broadcast/test-card.mp4");
    slow.load("https://cdn.example/live.mpd");
    await flush();
    expect(slow.loaded).toEqual(["https://cdn.example/live.mpd"]);
  });
});
