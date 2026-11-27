import { afterEach, describe, expect, it } from "vitest";
import {
  alphaOf,
  BROADCAST_LAYER_ATTRIBUTE,
  type BroadcastLayer,
  type BroadcastStream,
  coversVideoPlane,
  createBroadcastLayer,
} from "./broadcastLayer";
import { createTvVolume } from "./tvVolume";
import { VideoStreamPlayState as Stream, type VideoStreamPlayState } from "./videoStream";

/** MutationObserver callbacks are microtasks; the background check waits for a frame. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 50));

type Call = { readonly load: string } | { readonly play: true } | { readonly stop: true };

const setup = () => {
  const calls: Call[] = [];
  const listeners = new Set<(state: VideoStreamPlayState) => void>();
  const video = document.createElement("video");
  // jsdom plays nothing: the video is playing unless a test says the browser paused it.
  const media = { paused: false };
  Object.defineProperty(video, "paused", { get: () => media.paused });
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
  const layer = createBroadcastLayer({ document, stream, tvVolume, gain: (volume) => volume / 100 });
  layer.mount();
  mounted.push(layer);
  /** The stream changes state, as the player reports it. */
  const emit = (state: VideoStreamPlayState) => {
    for (const listener of [...listeners]) listener(state);
  };
  return { layer, calls, video, emit, tvVolume, media };
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
    const { layer, emit } = setup();
    const heard: string[] = [];
    const other: string[] = [];
    const control = layer.control(addObject());
    control.onStreamStateChange((state) => heard.push(state._tag));
    layer.control(addObject()).onStreamStateChange((state) => other.push(state._tag));
    layer.tune("http://tv/dmax.mpd")();
    control.bind();

    emit(Stream.buffering());
    emit(Stream.playing());
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
