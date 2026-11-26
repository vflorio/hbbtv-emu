import type * as dashjs from "dashjs";
import { describe, expect, it } from "vitest";
import { dashTrackOf, inbandEventOf, textTrackStandIn } from "./mediaElementDash";

const payload = (event: Record<string, unknown>) => ({
  event: {
    id: 7,
    duration: 2,
    calculatedPresentationTime: 12.5,
    presentationTimeDelta: 0.5,
    messageData: new Uint8Array([1, 2, 3]),
    eventStream: { schemeIdUri: "urn:scte:scte35:2013:bin", value: "1", timescale: 90000 },
    ...event,
  },
});

describe("inbandEventOf: an emsg event as dash.js gives it to a listener", () => {
  it("on the element's timeline, with its id as a string and a copy of message_data", () => {
    const given = payload({});
    const event = inbandEventOf(given);

    expect(event).toMatchObject({
      schemeIdUri: "urn:scte:scte35:2013:bin",
      value: "1",
      id: "7",
      startTime: 12.5,
      duration: 2,
    });
    expect(new Uint8Array(event?.data as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
    given.event.messageData[0] = 9;
    expect(new Uint8Array(event?.data as ArrayBuffer)[0]).toBe(1);
  });

  it("an event of the MPD (presentationTimeDelta NaN) is not one", () => {
    expect(inbandEventOf(payload({ presentationTimeDelta: Number.NaN }))).toBeNull();
    expect(inbandEventOf({})).toBeNull();
  });

  it("an indeterminate event_duration (0xFFFF, 0xFFFFFFFF on the timescale) has no duration", () => {
    expect(inbandEventOf(payload({ duration: 0xffff / 90000 }))?.duration).toBeNull();
    expect(inbandEventOf(payload({ duration: 0xffffffff / 90000 }))?.duration).toBeNull();
    expect(inbandEventOf(payload({ duration: Number.NaN }))?.duration).toBeNull();
  });

  it("message_data as a string is its UTF-8; none is empty", () => {
    expect(new TextDecoder().decode(inbandEventOf(payload({ messageData: "hi" }))?.data)).toBe("hi");
    expect(inbandEventOf(payload({ messageData: undefined }))?.data.byteLength).toBe(0);
  });
});

describe("dashTrackOf: a track as dash.js offers it", () => {
  it("its ref, id, language, Roles and audio purposes of their schemes, and whether it has Accessibility", () => {
    const track = {
      id: "de",
      index: 2,
      isPreselection: false,
      lang: "de",
      roles: [
        { schemeIdUri: "urn:mpeg:dash:role:2011", value: "dub" },
        { schemeIdUri: "urn:mpeg:dash:role:2011", value: "main" },
        { schemeIdUri: "urn:example:role", value: "other" },
      ],
      accessibility: [{ schemeIdUri: "urn:tva:metadata:cs:AudioPurposeCS:2007", value: "1" }],
    } as unknown as dashjs.MediaInfo;

    expect(dashTrackOf(track)).toEqual({
      ref: "adaptation:2",
      id: "de",
      lang: "de",
      roles: ["dub", "main"],
      audioPurposes: ["1"],
      accessibility: true,
    });
    expect(
      dashTrackOf({ ...track, isPreselection: true, id: "p", roles: null, accessibility: null } as never),
    ).toMatchObject({
      ref: "preselection:p",
      roles: [],
      audioPurposes: [],
      accessibility: false,
    });
  });
});

describe("textTrackStandIn: what dash.js gets for a TextTrack of the page runtime", () => {
  it("adds its cues to the track, reads its mode and leaves it to the application", () => {
    const cues: unknown[] = [];
    const track = {
      mode: "hidden",
      cues,
      activeCues: [],
      addCue: (cue: unknown) => cues.push(cue),
      removeCue: (cue: unknown) => cues.splice(cues.indexOf(cue), 1),
    } as unknown as TextTrack;
    const standIn = textTrackStandIn(track) as Record<string, unknown> & Pick<TextTrack, "addCue" | "removeCue">;
    const cue = {} as TextTrackCue;

    standIn.addCue(cue);
    standIn.mode = "showing";
    standIn.renderingType = "default";

    expect(cues).toEqual([cue]);
    expect(standIn.cues).toBe(cues);
    expect(standIn.mode).toBe("hidden");
    expect(track.mode).toBe("hidden");
    expect((track as unknown as Record<string, unknown>).renderingType).toBeUndefined();
    standIn.removeCue(cue);
    expect(cues).toEqual([]);
  });
});
