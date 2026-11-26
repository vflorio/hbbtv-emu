/**
 * The HTML5 DASH scenario both hosts run on `dash-app/index.xhtml` (TS 102 796
 * §9.4.2): two videos of the markup play an MPD by themselves (its `src` attribute,
 * and its first `<source>`, before an audio fallback); the application sets an MPD as
 * the source of its own `<video>` and plays it to the end, as an HbbTV 2 VOD player
 * does; `removeAttribute("src")` and `load()` unload it; a missing MPD is an error of
 * the element.
 */

import { expect } from "vitest";
import type { Evaluate } from "./avControl";

type DashAppState = {
  initError: string | null;
  canPlayDash: string;
  tracks: unknown[];
  audioTrackEvents: string[];
  cues: { id: string; startTime: number; endTime: number; isDataCue: boolean; data: string }[];
  events: string[];
  errors: (number | null)[];
};

const app = (evaluate: Evaluate) => evaluate(() => (window as unknown as { __e2e: DashAppState }).__e2e);

const until = async (evaluate: Evaluate, fn: () => boolean, what: string, timeout = 10_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(fn)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${what}`);
};

/** HTML `MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED`: what the browser reports for a `src` it cannot fetch. */
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;
/** `HTMLMediaElement.HAVE_NOTHING`: no media. */
const HAVE_NOTHING = 0;

type Played = { src: string; currentSrc: string; duration: number; size: number[]; error: MediaError | null };

/**
 * `requested`: the paths the fixture server was asked for so far.
 */
export const runHtml5DashScenario = async (
  evaluate: Evaluate,
  mpdUrl: string,
  requested: () => ReadonlyArray<string>,
) => {
  expect(await app(evaluate)).toMatchObject({ initError: null, canPlayDash: "maybe" });

  // From the markup, by themselves (autoplay): the src attribute, and the first <source>
  // before the audio fallback. `src` reads nothing for the second, as in HTML.
  await until(
    evaluate,
    () => ["markup", "sourced"].every((id) => (document.getElementById(id) as HTMLVideoElement).ended),
    "the markup's videos ended",
  );
  const fromMarkup = await evaluate(() =>
    ["markup", "sourced"].map((id): Played => {
      const video = document.getElementById(id) as HTMLVideoElement;
      return {
        src: video.src,
        currentSrc: video.currentSrc,
        duration: video.duration,
        size: [video.videoWidth, video.videoHeight],
        error: video.error,
      };
    }),
  );
  expect(fromMarkup).toEqual([
    { src: mpdUrl, currentSrc: mpdUrl, duration: 3, size: [160, 90], error: null },
    { src: "", currentSrc: mpdUrl, duration: 3, size: [160, 90], error: null },
  ]);

  // Played to the end, as from the MPD: its duration and size; the application reads its own URL back.
  await evaluate(() => {
    const video = document.getElementById("video") as HTMLVideoElement;
    video.src = "clip.mpd";
    void video.play();
  });
  await until(evaluate, () => (document.getElementById("video") as HTMLVideoElement).ended, "ended");
  const ended = await evaluate(() => {
    const video = document.getElementById("video") as HTMLVideoElement;
    return {
      src: video.src,
      currentSrc: video.currentSrc,
      duration: video.duration,
      size: [video.videoWidth, video.videoHeight],
      error: video.error,
    };
  });
  expect(ended).toEqual({ src: mpdUrl, currentSrc: mpdUrl, duration: 3, size: [160, 90], error: null });
  expect((await app(evaluate)).events).toEqual(["loadedmetadata", "playing", "ended"]);

  // The MPD's events and its segments' (emsg), as the application follows them (TS 102
  // 796 §9.3.2.2): a hidden
  // metadata track per event stream, a DataCue per event, entered as it plays.
  await evaluate(() => {
    const video = document.getElementById("events") as HTMLVideoElement;
    video.src = "events.mpd";
    void video.play();
  });
  await until(evaluate, () => (document.getElementById("events") as HTMLVideoElement).ended, "events.mpd ended");
  const followed = await app(evaluate);
  expect(followed.tracks).toEqual([
    { kind: "metadata", label: "", language: "", id: "", mode: "hidden", dispatchType: "urn:hbbtv-emu:e2e:text 1" },
    {
      kind: "metadata",
      label: "",
      language: "",
      id: "",
      mode: "hidden",
      dispatchType: "urn:scte:scte35:2014:xml+bin ",
    },
    // The segments' stream (emsg), as the MPD declares it.
    {
      kind: "metadata",
      label: "",
      language: "",
      id: "",
      mode: "hidden",
      dispatchType: "urn:hbbtv-emu:e2e:inband 1",
    },
  ]);
  expect(followed.cues.map(({ data, ...cue }) => cue)).toEqual([
    { id: "1", startTime: 0.5, endTime: 1.5, isDataCue: true },
    { id: "10", startTime: 1, endTime: Number.MAX_VALUE, isDataCue: true },
    // An emsg of the second segment (from 1 s): 500 ms in, 300 ms long.
    { id: "7", startTime: 1.5, endTime: 1.8, isDataCue: true },
    // 100 ms long: 250 ms, so that it is not missed.
    { id: "2", startTime: 2, endTime: 2.25, isDataCue: true },
  ]);
  expect(followed.cues.map((cue) => cue.data)).toEqual([
    "hello",
    expect.stringMatching(
      /^<Event [^>]*id="10"[^>]*><scte35:Signal xmlns:scte35="urn:scte:scte35:2013:xml"><scte35:Binary>\/DAvAAA=<\/scte35:Binary><\/scte35:Signal><\/Event>$/,
    ),
    "inband",
    "world",
  ]);

  // The audio and video tracks (TS 102 796 A.2.12.1, A.2.12.3): the MPD's AdaptationSets,
  // in its order, with its @lang and the kind of their Roles; one audio track enabled,
  // and enabling the other switches dash.js to it.
  await evaluate(() => {
    const video = document.getElementById("languages") as HTMLVideoElement;
    video.src = "languages.mpd";
    void video.play();
  });
  type Track = { id: string; kind: string; label: string; language: string; enabled?: boolean; selected?: boolean };
  type Lists = { audioTracks: ArrayLike<Track>; videoTracks: ArrayLike<Track> };
  await until(
    evaluate,
    () => {
      const video = document.getElementById("languages") as HTMLVideoElement;
      return (video as unknown as Lists).audioTracks.length === 2 && video.readyState >= 1;
    },
    "the audio tracks",
  );
  const listed = await evaluate(() => {
    const lists = document.getElementById("languages") as unknown as Lists;
    const copy = ({ id, kind, label, language, enabled, selected }: Track) => ({
      id,
      kind,
      label,
      language,
      enabled,
      selected,
    });
    return { audio: Array.from(lists.audioTracks).map(copy), video: Array.from(lists.videoTracks).map(copy) };
  });
  expect(listed.audio.map(({ enabled, ...track }) => track)).toEqual([
    { id: "de", kind: "translation", label: "", language: "ger", selected: undefined },
    { id: "en", kind: "main", label: "", language: "eng", selected: undefined },
  ]);
  expect(listed.audio.filter((track) => track.enabled)).toHaveLength(1);
  expect(listed.video).toEqual([
    { id: "v", kind: "main", label: "", language: "", enabled: undefined, selected: true },
  ]);

  const other = listed.audio.findIndex((track) => !track.enabled);
  const otherRepresentation = other === 0 ? "a1" : "a0";
  expect(requested().some((path) => path.includes(`audio-init-${otherRepresentation}`))).toBe(false);
  await evaluate(() => {
    const lists = document.getElementById("languages") as unknown as Lists;
    const disabled = Array.from(lists.audioTracks).find((track) => !track.enabled) as Track;
    disabled.enabled = true;
  });
  // To the end of the media. Not `ended` on Chromium: the switch came after dash.js had
  // the whole MPD and ended its MediaSource, which replacing the audio opens again, and
  // dash.js does not end it twice (a limit, of a switch at the very end).
  await until(
    evaluate,
    () => {
      const video = document.getElementById("languages") as HTMLVideoElement;
      return video.ended || video.currentTime >= video.duration - 0.05;
    },
    "languages.mpd played to its end",
  );
  expect(requested().some((path) => path.includes(`audio-init-${otherRepresentation}`))).toBe(true);
  expect((await app(evaluate)).audioTrackEvents).toEqual(["addtrack de", "addtrack en", "change"]);
  expect(
    await evaluate(() =>
      Array.from((document.getElementById("languages") as unknown as Lists).audioTracks).map((track) => track.enabled),
    ),
  ).toEqual(other === 0 ? [true, false] : [false, true]);

  // Unloaded the HTML way: the element has no source any more.
  const unloaded = await evaluate(() => {
    const video = document.getElementById("video") as HTMLVideoElement;
    video.removeAttribute("src");
    video.load();
    return { src: video.src, readyState: video.readyState };
  });
  expect(unloaded).toEqual({ src: "", readyState: HAVE_NOTHING });

  // A missing MPD fails as a missing source of the browser's own would.
  await evaluate(() => {
    const video = document.getElementById("video") as HTMLVideoElement;
    video.src = "missing.mpd";
    void video.play().catch(() => {});
  });
  await until(
    evaluate,
    () => (window as unknown as { __e2e: DashAppState }).__e2e.errors.length > 0,
    "the error event",
    20_000,
  );
  // Once, as the browser reports a source it cannot play, although dash.js reports more.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect((await app(evaluate)).errors).toEqual([MEDIA_ERR_SRC_NOT_SUPPORTED]);

  // Every error event since the document started: none for the MPD of the markup's src
  // attribute (the browser let it go before its fetch failed), and the missing MPD's.
  // The browser still fires one at the DASH <source> it cannot play itself, which a
  // terminal would not (a limit of the emulator).
  expect(await evaluate(() => (window as unknown as { __mediaErrors: string[] }).__mediaErrors)).toEqual([
    "sourced:source:-",
    "video:video:4",
  ]);
};
