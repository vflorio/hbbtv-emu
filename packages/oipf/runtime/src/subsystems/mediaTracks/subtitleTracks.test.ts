import { describe, expect, it, vi } from "vitest";
import { createSubtitleTracks, type SubtitleTrackInit } from "./subtitleTracks";

type FakeTrack = { kind: string; label: string; language: string; mode: TextTrackMode; cues: unknown[] };

/** An element as far as its text tracks go: `addTextTrack()` and the list's `change`. */
const fakeElement = () => {
  const tracks: FakeTrack[] = [];
  const textTracks = new EventTarget();
  const element = {
    textTracks,
    addTextTrack: (kind: string, label: string, language: string) => {
      const cues: unknown[] = [];
      const track = {
        kind,
        label,
        language,
        mode: "hidden" as TextTrackMode,
        cues,
        removeCue: (cue: unknown) => cues.splice(cues.indexOf(cue), 1),
      };
      tracks.push(track);
      return track;
    },
  } as unknown as HTMLMediaElement;
  /** The application sets a mode: the browser fires `change` at the list. */
  const setMode = (track: TextTrack, mode: TextTrackMode) => {
    track.mode = mode;
    textTracks.dispatchEvent(new Event("change"));
  };
  return { element, tracks, setMode };
};

const german: SubtitleTrackInit = { ref: "adaptation:2", id: "2", kind: "subtitles", language: "ger" };
const english: SubtitleTrackInit = { ref: "adaptation:3", id: "3", kind: "captions", language: "eng" };

describe("the TextTracks of DASH subtitles (TS 102 796 A.2.12.1)", () => {
  it('one per track, with its kind and language, label "" and the AdaptationSet\'s id; disabled', () => {
    const { element, tracks } = fakeElement();
    const subtitles = createSubtitleTracks(element, vi.fn());

    const track = subtitles.track(german);

    expect(tracks).toEqual([
      expect.objectContaining({ kind: "subtitles", label: "", language: "ger", mode: "disabled" }),
    ]);
    expect(track.id).toBe("2");
  });

  it("dash.js fetches the first track showing, otherwise the first hidden, none if all are disabled", () => {
    const { element, setMode } = fakeElement();
    const select = vi.fn();
    const subtitles = createSubtitleTracks(element, select);
    const [de, en] = [subtitles.track(german), subtitles.track(english)];
    expect(select).not.toHaveBeenCalled();

    setMode(en, "hidden");
    setMode(de, "showing");
    setMode(en, "showing");
    setMode(de, "disabled");
    setMode(en, "disabled");

    expect(select.mock.calls).toEqual([["adaptation:3"], ["adaptation:2"], ["adaptation:3"], [null]]);
  });

  it("the same kind, language and id in another Period is the same track, under its new ref", () => {
    const { element, tracks, setMode } = fakeElement();
    const select = vi.fn();
    const subtitles = createSubtitleTracks(element, select);
    const track = subtitles.track(german);
    setMode(track, "showing");

    expect(subtitles.track({ ...german, ref: "adaptation:1" })).toBe(track);
    expect(tracks).toHaveLength(1);
    expect(select.mock.calls).toEqual([["adaptation:2"], ["adaptation:1"]]);
  });

  it("clear() empties and disables them, and dash.js fetches none; the same track again finds its TextTrack", () => {
    const { element, tracks, setMode } = fakeElement();
    const select = vi.fn();
    const subtitles = createSubtitleTracks(element, select);
    const track = subtitles.track(german);
    setMode(track, "showing");
    tracks[0]?.cues.push({ startTime: 0 });

    subtitles.clear();

    expect(tracks[0]).toMatchObject({ mode: "disabled", cues: [] });
    expect(select.mock.calls).toEqual([["adaptation:2"], [null]]);
    expect(subtitles.track(german)).toBe(track);
    expect(tracks).toHaveLength(1);
  });
});
