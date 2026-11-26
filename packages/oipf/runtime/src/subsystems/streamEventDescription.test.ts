import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { describe, expect, it } from "vitest";
import { broadbandDescriptionUrl, describeStreamEvent, parseStreamEventDescription } from "./streamEventDescription";

describe("broadbandDescriptionUrl", () => {
  it.each([
    ["http://tv/it/default.ste", "http://app/index.html", O.some("http://tv/it/default.ste")],
    ["https://tv/a.ste", "http://app/index.html", O.some("https://tv/a.ste")],
    ["events/a.ste", "http://app/dir/index.html", O.some("http://app/dir/events/a.ste")],
    ["/a.ste", "https://app/dir/index.html", O.some("https://app/a.ste")],
    ["dvb://1.2.3.4/events", "http://app/index.html", O.none],
    ["events/a", "dvb://1.2.3.4/index.html", O.none],
  ])("%s from %s", (targetURL, base, expected) => {
    expect(broadbandDescriptionUrl(targetURL, base)).toEqual(expected);
  });
});

describe("parseStreamEventDescription (TS 102 809 §8.2, TS 102 796 §9.3.1)", () => {
  it("lists the events of every DSM-CC object, with their component tag", () => {
    const xml = `<dsmcc xmlns="urn:dvb:mis:dsmcc:2009">
      <dsmcc_object component_tag="2">
        <stream_event stream_event_id="1" stream_event_name="sevent"/>
        <stream_event stream_event_id="2" stream_event_name="other"/>
      </dsmcc_object>
      <dsmcc_object component_tag="255"><stream_event stream_event_id="65535" stream_event_name="last"/></dsmcc_object>
    </dsmcc>`;

    expect(parseStreamEventDescription(xml)).toEqual(
      E.right([
        { componentTag: 2, id: 1, name: "sevent" },
        { componentTag: 2, id: 2, name: "other" },
        { componentTag: 255, id: 65535, name: "last" },
      ]),
    );
  });

  it("leaves out the entries whose id or component tag is out of range", () => {
    const xml = `<dsmcc>
      <dsmcc_object component_tag="256"><stream_event stream_event_id="1" stream_event_name="a"/></dsmcc_object>
      <dsmcc_object component_tag="1">
        <stream_event stream_event_id="-1" stream_event_name="b"/>
        <stream_event stream_event_id="x" stream_event_name="c"/>
        <stream_event stream_event_id="3"/>
        <stream_event stream_event_id="4" stream_event_name="d"/>
      </dsmcc_object>
    </dsmcc>`;

    expect(parseStreamEventDescription(xml)).toEqual(E.right([{ componentTag: 1, id: 4, name: "d" }]));
  });

  it("fails on what is not XML, or not a DSM-CC description", () => {
    expect(E.isLeft(parseStreamEventDescription("<dsmcc>"))).toBe(true);
    expect(parseStreamEventDescription("<events/>")).toEqual(E.left("its root is <events>, not <dsmcc>"));
  });
});

describe("describeStreamEvent", () => {
  const xml = `<dsmcc><dsmcc_object component_tag="2"><stream_event stream_event_id="1" stream_event_name="sevent"/></dsmcc_object></dsmcc>`;

  it("finds the event by name, whatever the content type", async () => {
    const describe = describeStreamEvent(() => TE.right({ contentType: "text/plain", body: xml }));

    expect(await describe("http://tv/a.ste", "sevent")()).toEqual(E.right({ componentTag: 2, id: 1, name: "sevent" }));
  });

  it("says why it cannot, with the URL", async () => {
    const describe = describeStreamEvent(() => TE.left("HTTP 404"));
    const notThere = describeStreamEvent(() => TE.right({ contentType: null, body: xml }));

    expect(await describe("http://tv/a.ste", "sevent")()).toEqual(E.left("http://tv/a.ste: HTTP 404"));
    expect(await notThere("http://tv/a.ste", "x")()).toEqual(
      E.left('http://tv/a.ste: it does not describe an event named "x"'),
    );
  });
});
