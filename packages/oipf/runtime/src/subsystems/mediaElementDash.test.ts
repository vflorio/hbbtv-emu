import type { MediaElementDashEngine, MediaElementDashHooks } from "@hbb-emu/player-adapter-web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canPlayDash, installMediaElementDash } from "./mediaElementDash";
import { createEmulatorMedia, type EmulatorMedia } from "./mediaElementVolume";

const prototype = HTMLMediaElement.prototype;
const browserLoad = Object.getOwnPropertyDescriptor(prototype, "load") as PropertyDescriptor;
const browserCanPlayType = Object.getOwnPropertyDescriptor(prototype, "canPlayType") as PropertyDescriptor;

/** jsdom has no `error` accessor nor `MediaError`: as a browser does, with no error. */
class FakeMediaError {}

/** jsdom cannot load: `load()` only says it was called. */
const loads = vi.fn();

/** What the browser holds as the element's source: its own attribute. */
const browserSource = (element: HTMLMediaElement) => element.getAttribute("src");

/** dash.js, as it writes to the element: `attach()` is the moment its MediaSource is attached. */
type FakeDash = {
  element: HTMLMediaElement;
  hooks: MediaElementDashHooks;
  sources: string[];
  resets: number;
  attach: () => void;
};

let dashes: FakeDash[];
let emulatorMedia: EmulatorMedia;
let uninstall = () => {};

const engine: MediaElementDashEngine = {
  create: (element, hooks) => {
    const dash: FakeDash = {
      element,
      hooks,
      sources: [],
      resets: 0,
      attach: () =>
        hooks.internally(() => {
          element.src = `blob:http://localhost/${dash.sources.length}`;
        }),
    };
    dashes.push(dash);
    return {
      attachSource: (url) => {
        dash.sources.push(url);
      },
      reset: () =>
        hooks.internally(() => {
          dash.resets++;
          element.removeAttribute("src");
          element.load();
        }),
    };
  },
  isTypeSupported: (type) => type.includes("avc1") || type.includes("mp4a"),
};

beforeEach(() => {
  dashes = [];
  loads.mockReset();
  Object.defineProperty(prototype, "load", {
    ...browserLoad,
    value(this: HTMLMediaElement) {
      loads(this);
    },
  });
  Object.defineProperty(prototype, "error", { configurable: true, get: () => null });
  Object.defineProperty(window, "MediaError", { configurable: true, value: FakeMediaError });
  emulatorMedia = createEmulatorMedia();
  uninstall = installMediaElementDash({ window, emulatorMedia, engine })();
});

afterEach(() => {
  uninstall();
  Object.defineProperty(prototype, "load", browserLoad);
  delete (prototype as { error?: unknown }).error;
  delete (window as { MediaError?: unknown }).MediaError;
});

describe("DASH in the application's media (TS 102 796 §9.4.2)", () => {
  it("presents an MPD with dash.js, and the application reads back the URL it set", () => {
    const video = document.createElement("video");

    video.src = "vod/movie.mpd?token=1";

    expect(dashes).toHaveLength(1);
    expect(dashes[0]?.sources).toEqual(["http://localhost:3000/vod/movie.mpd?token=1"]);
    dashes[0]?.attach();
    expect(browserSource(video)).toBe("blob:http://localhost/1");
    expect(video.src).toBe("http://localhost:3000/vod/movie.mpd?token=1");
    expect(video.currentSrc).toBe("http://localhost:3000/vod/movie.mpd?token=1");
  });

  it("leaves any other source to the browser", () => {
    const video = document.createElement("video");

    video.src = "clip.mp4";

    expect(dashes).toEqual([]);
    expect(browserSource(video)).toBe("clip.mp4");
    expect(video.src).toBe("http://localhost:3000/clip.mp4");
  });

  it("a new MPD starts over with the same dash.js; another source ends it, and the browser plays that one", () => {
    const video = document.createElement("video");
    video.src = "a.mpd";
    dashes[0]?.attach();

    video.src = "a.mpd";
    video.src = "b.MPD";
    expect(dashes).toHaveLength(1);
    expect(dashes[0]?.sources).toEqual([
      "http://localhost:3000/a.mpd",
      "http://localhost:3000/a.mpd",
      "http://localhost:3000/b.MPD",
    ]);

    video.src = "clip.mp4";
    expect(dashes[0]?.resets).toBe(1);
    expect(browserSource(video)).toBe("clip.mp4");
    expect(video.src).toBe("http://localhost:3000/clip.mp4");
  });

  it("an MPD after a source of the browser ends that one first", () => {
    const video = document.createElement("video");
    video.src = "clip.mp4";

    video.src = "movie.mpd";

    expect(loads).toHaveBeenCalledWith(video);
    expect(browserSource(video)).toBeNull();
    expect(dashes[0]?.sources).toEqual(["http://localhost:3000/movie.mpd"]);
  });

  it("load() right after src leaves dash.js on its way; once attached, it starts over", () => {
    const video = document.createElement("video");
    video.src = "movie.mpd";

    video.load();
    expect(dashes[0]?.sources).toHaveLength(1);
    expect(loads).not.toHaveBeenCalled();

    dashes[0]?.attach();
    video.load();
    expect(dashes[0]?.sources).toHaveLength(2);
  });

  it("removeAttribute('src') and load() unload it, as HTML has an application do", () => {
    const video = document.createElement("video");
    video.src = "movie.mpd";
    dashes[0]?.attach();

    video.removeAttribute("src");
    video.load();

    expect(dashes[0]?.resets).toBe(1);
    expect(video.src).toBe("");
    // Unloaded, the element is the browser's again.
    video.src = "movie.mpd";
    expect(dashes).toHaveLength(2);
  });

  it("a fatal error of dash.js is the element's error, with an error event", () => {
    const video = document.createElement("video");
    const events: string[] = [];
    video.addEventListener("error", (event) => events.push(event.type));
    video.src = "missing.mpd";

    dashes[0]?.hooks.onError(4, "manifest 404");

    expect(events).toEqual(["error"]);
    expect(video.error).toBeInstanceOf(FakeMediaError);
    expect(video.error).toMatchObject({ code: 4, message: "manifest 404" });
    // A new source clears it.
    video.src = "movie.mpd";
    expect(video.error).toBeNull();
  });

  it("an error of a presentation that ended is not the element's", () => {
    const video = document.createElement("video");
    const events: string[] = [];
    video.addEventListener("error", (event) => events.push(event.type));
    video.src = "movie.mpd";
    const first = dashes[0];
    video.src = "clip.mp4";

    first?.hooks.onError(2, "late");

    expect(events).toEqual([]);
    expect(video.error).toBeNull();
  });

  it("leaves the OIPF objects' videos alone: their player chooses an adapter itself", () => {
    const video = document.createElement("video");
    emulatorMedia.add(video)();

    video.src = "stream.mpd";

    expect(dashes).toEqual([]);
    expect(browserSource(video)).toBe("stream.mpd");
  });

  it("answers canPlayType for DASH, and lets the browser answer the rest", () => {
    const video = document.createElement("video");

    expect(video.canPlayType("application/dash+xml")).toBe("maybe");
    expect(video.canPlayType('application/dash+xml; codecs="avc1.4d401f, mp4a.40.2"')).toBe("probably");
    expect(video.canPlayType('application/dash+xml; codecs="hev1.1.6.L93.B0"')).toBe("");
    expect(video.canPlayType("video/x-unknown")).toBe("");
  });

  it("uninstalled, the browser's accessors are back", () => {
    uninstall();
    uninstall = () => {};

    expect(Object.getOwnPropertyDescriptor(prototype, "canPlayType")).toEqual(browserCanPlayType);
    const video = document.createElement("video");
    video.src = "movie.mpd";
    expect(dashes).toEqual([]);
    expect(browserSource(video)).toBe("movie.mpd");
  });
});

describe("canPlayDash", () => {
  const supported = (type: string) => type.includes("avc1");

  it.each<[string, string | null]>([
    ["application/dash+xml", "maybe"],
    ["APPLICATION/DASH+XML ; charset=utf-8", "maybe"],
    ['application/dash+xml; codecs="avc1.64001f"', "probably"],
    ["application/dash+xml; codecs=avc1.64001f", "probably"],
    ['application/dash+xml; codecs=""', ""],
    ['application/dash+xml; codecs="avc1.64001f,ec-3"', ""],
    ["video/mp4", null],
  ])("%s → %s", (type, answer) => {
    expect(canPlayDash(type, supported)).toBe(answer);
  });
});
