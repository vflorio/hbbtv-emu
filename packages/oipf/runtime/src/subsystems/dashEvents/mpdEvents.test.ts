import { describe, expect, it } from "vitest";
import { dispatchType, inbandEventStreams, MINIMUM_CUE_DURATION, mpdEventStreams, parseDuration } from "./mpdEvents";

const parse = (mpd: string) =>
  mpdEventStreams(new DOMParser().parseFromString(mpd, "application/xml"), (node) =>
    new XMLSerializer().serializeToString(node),
  );

const text = (data: ArrayBuffer) => new TextDecoder().decode(data);

const MPD = (periods: string) =>
  `<?xml version="1.0" encoding="utf-8"?><MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static">${periods}</MPD>`;

describe("the events of an MPD (TS 102 796 §9.3.2.2)", () => {
  it("one stream per scheme and value, its events' times on the timescale, from the Period's start", () => {
    const [stream, ...others] = parse(
      MPD(`
        <Period id="p0" start="PT10S">
          <EventStream schemeIdUri="urn:example:ad" value="1" timescale="1000">
            <Event id="7" presentationTime="1500" duration="2000">break</Event>
          </EventStream>
        </Period>`),
    );

    expect(others).toEqual([]);
    expect(stream).toMatchObject({ schemeIdUri: "urn:example:ad", value: "1" });
    expect(stream?.events).toHaveLength(1);
    expect(stream?.events[0]).toMatchObject({ id: "7", startTime: 11.5, endTime: 13.5 });
    expect(text(stream?.events[0]?.data as ArrayBuffer)).toBe("break");
  });

  it("an event of 250 ms or less lasts 250 ms; one with no duration, until Number.MAX_VALUE", () => {
    const events = parse(
      MPD(`
        <Period>
          <EventStream schemeIdUri="urn:example:ad">
            <Event presentationTime="2" duration="0">a</Event>
            <Event presentationTime="3">b</Event>
            <Event>c</Event>
          </EventStream>
        </Period>`),
    )[0]?.events;

    expect(events?.map(({ id, startTime, endTime }) => ({ id, startTime, endTime }))).toEqual([
      { id: "", startTime: 2, endTime: 2 + MINIMUM_CUE_DURATION },
      { id: "", startTime: 3, endTime: Number.MAX_VALUE },
      { id: "", startTime: 0, endTime: Number.MAX_VALUE },
    ]);
  });

  it("presentationTimeOffset moves the events back", () => {
    const event = parse(
      MPD(`
        <Period start="PT1M">
          <EventStream schemeIdUri="urn:example:ad" timescale="90000" presentationTimeOffset="900000">
            <Event presentationTime="1080000" duration="90000">x</Event>
          </EventStream>
        </Period>`),
    )[0]?.events[0];

    expect(event).toMatchObject({ startTime: 62, endTime: 63 });
  });

  it("data: base64 decoded; an Event with elements, or empty, is the Event element as XML", () => {
    const events = parse(
      MPD(`
        <Period>
          <EventStream schemeIdUri="urn:scte:scte35:2014:xml+bin">
            <Event id="1" contentEncoding="base64">aGVsbG8=</Event>
            <Event id="2"><Signal xmlns="urn:scte:scte35:2013:xml"><Binary>/DAvAAA=</Binary></Signal></Event>
            <Event id="3"/>
          </EventStream>
        </Period>`),
    )[0]?.events;

    expect(text(events?.[0]?.data as ArrayBuffer)).toBe("hello");
    const signal = text(events?.[1]?.data as ArrayBuffer);
    expect(signal).toMatch(
      /^<Event [^>]*id="2"[^>]*><Signal xmlns="urn:scte:scte35:2013:xml"><Binary>\/DAvAAA=<\/Binary><\/Signal><\/Event>$/,
    );
    expect(text(events?.[2]?.data as ArrayBuffer)).toMatch(/^<Event [^>]*id="3"[^>]*\/>$/);
  });

  it("the Periods' starts follow from the previous one's start and duration; an unknown start has no events", () => {
    const streams = parse(
      MPD(`
        <Period duration="PT30S"><EventStream schemeIdUri="urn:example:ad"><Event id="a" presentationTime="1">a</Event></EventStream></Period>
        <Period duration="PT15S"><EventStream schemeIdUri="urn:example:ad"><Event id="b" presentationTime="1">b</Event></EventStream></Period>
        <Period><EventStream schemeIdUri="urn:example:ad"><Event id="c" presentationTime="1">c</Event></EventStream></Period>
        <Period><EventStream schemeIdUri="urn:example:ad"><Event id="d" presentationTime="1">d</Event></EventStream></Period>`),
    );

    // One stream across the Periods, as an application follows it.
    expect(streams).toHaveLength(1);
    expect(streams[0]?.events.map(({ id, startTime }) => [id, startTime])).toEqual([
      ["a", 1],
      ["b", 31],
      ["c", 46],
    ]);
  });

  it("leaves DASH's own events to dash.js, and an EventStream with no scheme", () => {
    const streams = parse(
      MPD(`
        <Period>
          <EventStream schemeIdUri="urn:mpeg:dash:event:2012" value="1"><Event presentationTime="1"/></EventStream>
          <EventStream schemeIdUri="urn:mpeg:dash:event:callback:2015" value="1"><Event presentationTime="1"/></EventStream>
          <EventStream><Event presentationTime="1"/></EventStream>
          <EventStream schemeIdUri="urn:example:ad" value="2"/>
        </Period>`),
    );

    expect(streams.map(dispatchType)).toEqual(["urn:example:ad 2"]);
  });

  it("not an MPD: no events", () => {
    expect(parse("<html/>")).toEqual([]);
    expect(parse("not xml")).toEqual([]);
  });
});

describe("the InbandEventStreams of an MPD", () => {
  it("of the AdaptationSets and Representations, once each, DASH's own left to dash.js", () => {
    const document = new DOMParser().parseFromString(
      MPD(`
        <Period>
          <AdaptationSet>
            <InbandEventStream schemeIdUri="urn:scte:scte35:2013:bin"/>
            <InbandEventStream schemeIdUri="urn:mpeg:dash:event:2012" value="1"/>
            <Representation id="a"><InbandEventStream schemeIdUri="urn:example:id3" value="2"/></Representation>
            <Representation id="b"><InbandEventStream schemeIdUri="urn:example:id3" value="2"/></Representation>
          </AdaptationSet>
        </Period>`),
      "application/xml",
    );

    expect(inbandEventStreams(document).map(dispatchType)).toEqual(["urn:scte:scte35:2013:bin ", "urn:example:id3 2"]);
  });
});

describe("parseDuration", () => {
  it.each<[string, number | null]>([
    ["PT0S", 0],
    ["PT1.5S", 1.5],
    ["PT2M3S", 123],
    ["PT1H", 3600],
    ["P1DT1S", 86_401],
    ["P", null],
    ["PT", null],
    ["P1Y", null],
    ["10", null],
  ])("%s → %s", (value, seconds) => {
    expect(parseDuration(value)).toBe(seconds);
  });
});
