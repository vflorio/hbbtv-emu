import { describe, expect, it } from "vitest";
import { createEventTracks, PAST_INBAND_CUES, type ReceivedInbandEvent } from "./eventTracks";
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

    tracks.update([stream("1", [event("a", 1)]), stream("2", [])], []);

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
    tracks.update([stream("1", [event("a", 1), event("b", 2), event("", 3, "x")])], []);
    const [a, , anonymous] = media.tracks[0]?.cues ?? [];

    // Same id, other content: the same event repeated (TS 103 285 §9.1.5).
    tracks.update([stream("1", [event("a", 1, "changed"), event("", 3, "x"), event("c", 4)])], []);

    const cues = media.tracks[0]?.cues ?? [];
    expect(media.tracks).toHaveLength(1);
    expect(cues.map((cue) => cue.id)).toEqual(["a", "", "c"]);
    expect(cues[0]).toBe(a);
    expect(cues[1]).toBe(anonymous);
  });

  it("a stream gone from the MPD leaves its track empty and disabled; back, it is hidden again", () => {
    const { media, tracks } = setUp();
    tracks.update([stream("1", [event("a", 1)]), stream("2", [event("b", 1)])], []);

    tracks.update([stream("2", [event("b", 1)])], []);
    expect(media.tracks[0]).toMatchObject({ mode: "disabled", cues: [] });
    expect(media.tracks[1]).toMatchObject({ mode: "hidden" });

    tracks.update([stream("1", [event("a", 1)])], []);
    expect(media.tracks).toHaveLength(2);
    expect(media.tracks[0]?.mode).toBe("hidden");
    expect(media.tracks[0]?.cues).toHaveLength(1);
  });

  it("the application's own mode stays", () => {
    const { media, tracks } = setUp();
    tracks.update([stream("1", [event("a", 1)])], []);
    const track = media.tracks[0] as FakeTrack;
    track.mode = "disabled";

    tracks.update([stream("1", [event("a", 1), event("b", 2)])], []);

    expect(track.mode).toBe("disabled");
    expect(track.cues).toHaveLength(2);
  });

  it("clear() empties and disables every track", () => {
    const { media, tracks } = setUp();
    tracks.update([stream("1", [event("a", 1)]), stream("2", [event("b", 1)])], []);

    tracks.clear();

    expect(media.tracks.map(({ mode, cues }) => ({ mode, cues: cues.length }))).toEqual([
      { mode: "disabled", cues: 0 },
      { mode: "disabled", cues: 0 },
    ]);
  });

  describe("the events of the segments (emsg)", () => {
    const inband = (id: string, startTime: number, duration: number | null = 1): ReceivedInbandEvent => ({
      schemeIdUri: "urn:example:inband",
      value: "1",
      id,
      startTime,
      duration,
      data: data(id),
    });
    const declared = [{ schemeIdUri: "urn:example:inband", value: "1" }];

    it("the MPD declares the stream: its track is there before the first event", () => {
      const { media, tracks } = setUp();

      tracks.update([], declared);

      expect(media.tracks).toHaveLength(1);
      expect(media.tracks[0]).toMatchObject({
        mode: "hidden",
        inBandMetadataTrackDispatchType: "urn:example:inband 1",
      });
    });

    it("each event received is a cue, once; 250 ms at least, Number.MAX_VALUE with no duration", () => {
      const { media, tracks } = setUp();
      tracks.update([], declared);

      tracks.addInband(inband("1", 10, 0.1), 9);
      tracks.addInband(inband("1", 10, 0.1), 9.5);
      tracks.addInband(inband("2", 12, null), 9.5);

      expect(media.tracks[0]?.cues.map(({ id, startTime, endTime }) => ({ id, startTime, endTime }))).toEqual([
        { id: "1", startTime: 10, endTime: 10.25 },
        { id: "2", startTime: 12, endTime: Number.MAX_VALUE },
      ]);
    });

    it("an MPD update leaves the segments' cues as they are", () => {
      const { media, tracks } = setUp();
      tracks.update([], declared);
      tracks.addInband(inband("1", 10), 9);

      tracks.update([], declared);

      expect(media.tracks[0]?.cues).toHaveLength(1);
    });

    it("past cues go once they ended long enough before the current time", () => {
      const { media, tracks } = setUp();
      tracks.update([], declared);
      tracks.addInband(inband("1", 10), 9);

      tracks.addInband(inband("2", 10 + PAST_INBAND_CUES), 11 + PAST_INBAND_CUES);
      expect(media.tracks[0]?.cues.map((cue) => cue.id)).toEqual(["1", "2"]);

      tracks.addInband(inband("3", 20 + PAST_INBAND_CUES), 11.5 + PAST_INBAND_CUES);
      expect(media.tracks[0]?.cues.map((cue) => cue.id)).toEqual(["2", "3"]);
    });

    it("one track for a stream both in the MPD and in the segments, with both's cues", () => {
      const { media, tracks } = setUp();
      tracks.update([{ schemeIdUri: "urn:example:inband", value: "1", events: [event("m", 1)] }], declared);

      tracks.addInband(inband("s", 2), 0);
      expect(media.tracks).toHaveLength(1);
      expect(media.tracks[0]?.cues.map((cue) => cue.id)).toEqual(["m", "s"]);

      // No more in the MPD, still in the segments: only the MPD's cues go.
      tracks.update([], declared);
      expect(media.tracks[0]?.cues.map((cue) => cue.id)).toEqual(["s"]);
    });

    it("a stream no more declared: its track empty and disabled", () => {
      const { media, tracks } = setUp();
      tracks.update([], declared);
      tracks.addInband(inband("1", 10), 9);

      tracks.update([], []);

      expect(media.tracks[0]).toMatchObject({ mode: "disabled", cues: [] });
    });
  });
});
