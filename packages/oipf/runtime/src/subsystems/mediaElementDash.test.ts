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

/** jsdom plays nothing: here the browser plays MP4, and nothing else. */
const nativeCanPlayType = (type: string): CanPlayTypeResult => (type.startsWith("video/mp4") ? "maybe" : "");

/** The observer's delivery of mutations. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** jsdom has no text tracks nor `VTTCue`: as a browser's, as far as the events need. */
class FakeVTTCue {
  id = "";
  pauseOnExit = false;
  constructor(
    readonly startTime: number,
    readonly endTime: number,
    readonly text: string,
  ) {}
}
type FakeTrack = { kind: string; mode: TextTrackMode; cues: FakeVTTCue[]; inBandMetadataTrackDispatchType?: string };
const textTracks = new WeakMap<HTMLMediaElement, FakeTrack[]>();
const tracksOf = (element: HTMLMediaElement) => textTracks.get(element) ?? [];
function addTextTrack(this: HTMLMediaElement, kind: string): FakeTrack {
  const cues: FakeVTTCue[] = [];
  const track = {
    kind,
    mode: "disabled" as TextTrackMode,
    cues,
    addCue: (cue: FakeVTTCue) => cues.push(cue),
    removeCue: (cue: FakeVTTCue) => cues.splice(cues.indexOf(cue), 1),
  };
  textTracks.set(this, [...tracksOf(this), track]);
  return track;
}

const MPD_WITH_EVENTS = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static"><Period start="PT0S">
  <EventStream schemeIdUri="urn:example:ad" value="1" timescale="1000"><Event id="1" presentationTime="1000" duration="500">break</Event></EventStream>
</Period></MPD>`;

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
  Object.defineProperty(prototype, "canPlayType", { ...browserCanPlayType, value: nativeCanPlayType });
  Object.defineProperty(prototype, "error", { configurable: true, get: () => null });
  Object.defineProperty(window, "MediaError", { configurable: true, value: FakeMediaError });
  Object.defineProperty(window, "VTTCue", { configurable: true, value: FakeVTTCue });
  Object.defineProperty(prototype, "addTextTrack", { configurable: true, value: addTextTrack });
  emulatorMedia = createEmulatorMedia();
  uninstall = installMediaElementDash({ window, emulatorMedia, engine })();
});

afterEach(() => {
  uninstall();
  Object.defineProperty(prototype, "load", browserLoad);
  Object.defineProperty(prototype, "canPlayType", browserCanPlayType);
  document.body.innerHTML = "";
  delete (prototype as { error?: unknown }).error;
  delete (window as { MediaError?: unknown }).MediaError;
  delete (window as { VTTCue?: unknown }).VTTCue;
  delete (prototype as { addTextTrack?: unknown }).addTextTrack;
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
    expect(video.canPlayType("video/mp4")).toBe("maybe");
  });

  it("uninstalled, the browser's accessors are back", () => {
    uninstall();
    uninstall = () => {};

    expect(Object.getOwnPropertyDescriptor(prototype, "canPlayType")?.value).toBe(nativeCanPlayType);
    const video = document.createElement("video");
    video.src = "movie.mpd";
    expect(dashes).toEqual([]);
    expect(browserSource(video)).toBe("movie.mpd");
  });
});

describe("an MPD in the src attribute", () => {
  it("of the markup: presented once the element is in the document, and the browser lets it go", async () => {
    document.body.innerHTML = '<div><video src="vod/movie.mpd" autoplay=""></video></div>';
    const video = document.querySelector("video") as HTMLVideoElement;

    await settle();

    expect(dashes[0]?.sources).toEqual(["http://localhost:3000/vod/movie.mpd"]);
    expect(browserSource(video)).toBeNull();
    expect(loads).toHaveBeenCalledWith(video);
    expect(video.src).toBe("http://localhost:3000/vod/movie.mpd");
  });

  it("from setAttribute(), followed by load(): seen in that order", () => {
    const video = document.createElement("video");
    document.body.appendChild(video);

    video.setAttribute("src", "movie.mpd");
    video.load();

    expect(dashes[0]?.sources).toEqual(["http://localhost:3000/movie.mpd"]);
    expect(video.currentSrc).toBe("http://localhost:3000/movie.mpd");
  });

  it("dash.js's own writes are not the application's", async () => {
    const video = document.createElement("video");
    document.body.appendChild(video);
    video.src = "movie.mpd";

    dashes[0]?.attach();
    await settle();

    expect(dashes).toHaveLength(1);
    expect(dashes[0]?.sources).toHaveLength(1);
    expect(dashes[0]?.resets).toBe(0);
  });

  it("another source in the attribute ends it, and the browser plays that one", async () => {
    const video = document.createElement("video");
    document.body.appendChild(video);
    video.src = "movie.mpd";
    dashes[0]?.attach();

    video.setAttribute("src", "clip.mp4");
    await settle();

    expect(dashes[0]?.resets).toBe(1);
    expect(browserSource(video)).toBe("clip.mp4");
    expect(video.src).toBe("http://localhost:3000/clip.mp4");
  });

  it("of an element outside the document: not seen until it is inserted", async () => {
    const video = document.createElement("video");
    video.setAttribute("src", "movie.mpd");
    await settle();
    expect(dashes).toEqual([]);

    document.body.appendChild(video);
    await settle();

    expect(dashes[0]?.sources).toEqual(["http://localhost:3000/movie.mpd"]);
  });
});

describe("an MPD in a <source> (HTML's resource selection)", () => {
  it("chosen as the browser chooses: the first source of a type it plays, or with no type", async () => {
    document.body.innerHTML = `
      <video id="a"><source src="clip.webm" type="video/webm"><source src="a.mpd" type="application/dash+xml"><source src="clip.mp4" type="video/mp4"></video>
      <video id="b"><source src="b.mpd"></video>
      <video id="c"><source src="clip.mp4" type="video/mp4"><source src="c.mpd" type="application/dash+xml"></video>
      <video id="d"><source src="d.mpd" type='application/dash+xml; codecs="hev1.1.6.L93.B0"'><source src="clip.mp4"></video>`;

    await settle();

    expect(dashes.map((dash) => [dash.element.id, dash.sources])).toEqual([
      ["a", ["http://localhost:3000/a.mpd"]],
      ["b", ["http://localhost:3000/b.mpd"]],
    ]);
  });

  it("src reads nothing, currentSrc the MPD", async () => {
    document.body.innerHTML = '<video><source src="movie.mpd" type="application/dash+xml"></video>';
    const video = document.querySelector("video") as HTMLVideoElement;
    await settle();
    dashes[0]?.attach();

    expect(video.src).toBe("");
    expect(video.currentSrc).toBe("http://localhost:3000/movie.mpd");
  });

  it("a <source> added to an element that presents nothing", async () => {
    const video = document.createElement("video");
    document.body.appendChild(video);
    await settle();

    const source = document.createElement("source");
    source.src = "movie.mpd";
    video.appendChild(source);
    await settle();

    expect(dashes[0]?.sources).toEqual(["http://localhost:3000/movie.mpd"]);
  });

  it("the src attribute comes first", async () => {
    document.body.innerHTML = '<video src="clip.mp4"><source src="movie.mpd"></video>';

    await settle();

    expect(dashes).toEqual([]);
  });

  it("load() chooses again: the sources the application left", async () => {
    document.body.innerHTML = '<video><source src="a.mpd"><source src="clip.mp4" type="video/mp4"></video>';
    const video = document.querySelector("video") as HTMLVideoElement;
    await settle();
    dashes[0]?.attach();

    video.querySelector("source")?.remove();
    video.load();

    expect(dashes[0]?.resets).toBe(1);
    expect(loads).toHaveBeenLastCalledWith(video);
    expect(video.currentSrc).toBe("");
  });

  it("the src attribute removed and load(): the <source> children choose", () => {
    const video = document.createElement("video");
    video.innerHTML = '<source src="b.mpd">';
    video.src = "a.mpd";
    dashes[0]?.attach();

    video.removeAttribute("src");
    video.load();

    expect(dashes).toHaveLength(2);
    expect(dashes[1]?.sources).toEqual(["http://localhost:3000/b.mpd"]);
    expect(video.currentSrc).toBe("http://localhost:3000/b.mpd");
  });
});

describe("the MPD's events (TS 102 796 §9.3.2.2)", () => {
  it("each MPD dash.js loads brings the element's metadata tracks in line, with DataCues", () => {
    const video = document.createElement("video");
    video.src = "movie.mpd";

    dashes[0]?.hooks.onManifest(MPD_WITH_EVENTS);

    const [track, ...others] = tracksOf(video);
    expect(others).toEqual([]);
    expect(track).toMatchObject({
      kind: "metadata",
      mode: "hidden",
      inBandMetadataTrackDispatchType: "urn:example:ad 1",
    });
    expect(track?.cues).toHaveLength(1);
    expect(track?.cues[0]).toBeInstanceOf((window as unknown as { DataCue: typeof FakeVTTCue }).DataCue);
    expect(track?.cues[0]).toMatchObject({ id: "1", startTime: 1, endTime: 1.5 });
    expect(new TextDecoder().decode((track?.cues[0] as unknown as { data: ArrayBuffer }).data)).toBe("break");
  });

  it("an MPD with no events makes no track", () => {
    const video = document.createElement("video");
    video.src = "movie.mpd";

    dashes[0]?.hooks.onManifest('<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"><Period/></MPD>');

    expect(tracksOf(video)).toEqual([]);
  });

  it("a new source, or the end of the presentation, empties the tracks", () => {
    const video = document.createElement("video");
    video.src = "movie.mpd";
    dashes[0]?.hooks.onManifest(MPD_WITH_EVENTS);

    video.src = "other.mpd";
    expect(tracksOf(video)[0]).toMatchObject({ mode: "disabled", cues: [] });

    dashes[0]?.hooks.onManifest(MPD_WITH_EVENTS);
    expect(tracksOf(video)[0]).toMatchObject({ mode: "hidden", cues: [expect.objectContaining({ id: "1" })] });

    video.src = "clip.mp4";
    expect(tracksOf(video)[0]).toMatchObject({ mode: "disabled", cues: [] });
  });

  it("an MPD of a presentation that ended is not the element's", () => {
    const video = document.createElement("video");
    video.src = "movie.mpd";
    video.src = "clip.mp4";

    dashes[0]?.hooks.onManifest(MPD_WITH_EVENTS);

    expect(tracksOf(video)).toEqual([]);
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
