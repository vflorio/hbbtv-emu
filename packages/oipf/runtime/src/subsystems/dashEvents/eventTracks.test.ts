import { describe, expect, it } from "vitest";
import { createEventTracks } from "./eventTracks";
import type { DashEvent, DashEventStream } from "./mpdEvents";

/** jsdom has no text tracks: one as a browser's `addTextTrack()` makes it. */
class FakeTrack {
  mode: TextTrackMode = "disabled";
  readonly cues: FakeCue[] = [];
  constructor(
    readonly kind: string,
    readonly label: string,
    readonly language: string,
  ) {}
  addCue(cue: FakeCue) {
    this.cues.push(cue);
  }
  removeCue(cue: FakeCue) {
    this.cues.splice(this.cues.indexOf(cue), 1);
  }
}

class FakeCue {
  id = "";
  pauseOnExit = true;
  constructor(
    readonly startTime: number,
    readonly endTime: number,
    readonly data: ArrayBuffer,
  ) {}
}

const element = () => {
  const tracks: FakeTrack[] = [];
  const media = {
    tracks,
    addTextTrack: (kind: string, label: string, language: string) => {
      const track = new FakeTrack(kind, label, language);
      tracks.push(track);
      return track;
    },
  };
  return media;
};

const data = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
const event = (id: string, startTime: number, payload = id): DashEvent => ({
  id,
  startTime,
  endTime: startTime + 1,
  data: data(payload),
});
const stream = (value: string, events: DashEvent[]): DashEventStream => ({
  schemeIdUri: "urn:example:ad",
  value,
  events,
});

const setUp = () => {
  const media = element();
  const tracks = createEventTracks(media as unknown as HTMLMediaElement, FakeCue as never);
  return { media, tracks };
};

describe("the TextTracks of an element's DASH event streams (TS 102 796 §9.3.2.2)", () => {
  it("one hidden metadata track per stream, with no label, language or id, its scheme and value as dispatch type", () => {
    const { media, tracks } = setUp();

    tracks.update([stream("1", [event("a", 1)]), stream("2", [])]);

    expect(media.tracks).toHaveLength(2);
    expect(media.tracks[0]).toMatchObject({
      kind: "metadata",
      label: "",
      language: "",
      mode: "hidden",
      inBandMetadataTrackDispatchType: "urn:example:ad 1",
    });
    expect(media.tracks[1]).toMatchObject({ inBandMetadataTrackDispatchType: "urn:example:ad 2" });
    expect(media.tracks[0]?.cues).toEqual([expect.objectContaining({ id: "a", startTime: 1, pauseOnExit: false })]);
  });

  it("an MPD update keeps the cues still there as they are, adds the new ones, removes the others", () => {
    const { media, tracks } = setUp();
    tracks.update([stream("1", [event("a", 1), event("b", 2), event("", 3, "x")])]);
    const [a, , anonymous] = media.tracks[0]?.cues ?? [];

    // Same id, other content: the same event repeated (TS 103 285 §9.1.5).
    tracks.update([stream("1", [event("a", 1, "changed"), event("", 3, "x"), event("c", 4)])]);

    const cues = media.tracks[0]?.cues ?? [];
    expect(media.tracks).toHaveLength(1);
    expect(cues.map((cue) => cue.id)).toEqual(["a", "", "c"]);
    expect(cues[0]).toBe(a);
    expect(cues[1]).toBe(anonymous);
  });

  it("a stream gone from the MPD leaves its track empty and disabled; back, it is hidden again", () => {
    const { media, tracks } = setUp();
    tracks.update([stream("1", [event("a", 1)]), stream("2", [event("b", 1)])]);

    tracks.update([stream("2", [event("b", 1)])]);
    expect(media.tracks[0]).toMatchObject({ mode: "disabled", cues: [] });
    expect(media.tracks[1]).toMatchObject({ mode: "hidden" });

    tracks.update([stream("1", [event("a", 1)])]);
    expect(media.tracks).toHaveLength(2);
    expect(media.tracks[0]?.mode).toBe("hidden");
    expect(media.tracks[0]?.cues).toHaveLength(1);
  });

  it("the application's own mode stays", () => {
    const { media, tracks } = setUp();
    tracks.update([stream("1", [event("a", 1)])]);
    const track = media.tracks[0] as FakeTrack;
    track.mode = "disabled";

    tracks.update([stream("1", [event("a", 1), event("b", 2)])]);

    expect(track.mode).toBe("disabled");
    expect(track.cues).toHaveLength(2);
  });

  it("clear() empties and disables every track", () => {
    const { media, tracks } = setUp();
    tracks.update([stream("1", [event("a", 1)]), stream("2", [event("b", 1)])]);

    tracks.clear();

    expect(media.tracks.map(({ mode, cues }) => ({ mode, cues: cues.length }))).toEqual([
      { mode: "disabled", cues: 0 },
      { mode: "disabled", cues: 0 },
    ]);
  });
});
