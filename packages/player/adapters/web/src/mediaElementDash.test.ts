import { describe, expect, it } from "vitest";
import { inbandEventOf } from "./mediaElementDash";

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
