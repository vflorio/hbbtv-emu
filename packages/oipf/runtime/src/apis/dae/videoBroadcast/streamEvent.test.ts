import type { OIPF } from "@hbb-emu/oipf-api";
import * as TE from "fp-ts/TaskEither";
import { describe, expect, it } from "vitest";
import type { FetchStreamEventDescription, StreamEventDescriptionFile } from "../../../subsystems";
import {
  addStreamEventListener,
  createStreamEventEnv,
  dropStreamEventListeners,
  readStreamEventListeners,
  removeStreamEventListener,
  type StreamEventEnv,
} from "./streamEvent";

type Listener = OIPF.DAE.Broadcast.StreamEventListener;
type StreamEvent = OIPF.DAE.Broadcast.StreamEvent;

const DESCRIPTION = `<?xml version="1.0" encoding="UTF-8"?>
<dsmcc xmlns="urn:dvb:mis:dsmcc:2009">
  <dsmcc_object component_tag="2">
    <stream_event stream_event_id="1" stream_event_name="sevent" />
  </dsmcc_object>
</dsmcc>`;

const served = (body: string): StreamEventDescriptionFile => ({
  contentType: "application/vnd.dvb.streamevent+xml",
  body,
});

/** Descriptions by URL; a URL missing is a fetch that fails. */
const fetchFrom =
  (files: Record<string, StreamEventDescriptionFile>): FetchStreamEventDescription =>
  (url) => {
    const file = files[url];
    return file ? TE.right(file) : TE.left("HTTP 404");
  };

const setup = (fetchDescription: FetchStreamEventDescription = fetchFrom({})) => {
  const subscribed: string[] = [];
  const unsubscribed: string[] = [];
  const scheduler: StreamEventEnv["scheduler"] = {
    addListener: (targetURL, eventName) => () => {
      const id = `${targetURL}#${eventName}#${subscribed.length}`;
      subscribed.push(id);
      return {
        unsubscribe: () => {
          unsubscribed.push(id);
        },
      };
    },
  };
  const env = createStreamEventEnv({ scheduler, fetchDescription, baseURI: () => "http://tv/app/index.html" })();
  return { env, subscribed, unsubscribed };
};

/** Lets the description's fetch settle. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

const recording = () => {
  const events: StreamEvent[] = [];
  const listener: Listener = (event) => {
    events.push(event);
  };
  return { events, listener };
};

const listener: Listener = () => {};
const other: Listener = () => {};

describe("stream event listeners", () => {
  it("each addition subscribes to the scheduler, even of the same listener", () => {
    const { env, subscribed } = setup();

    addStreamEventListener("dvb://1", "now", listener)(env)();
    addStreamEventListener("dvb://1", "now", listener)(env)();

    expect(subscribed).toHaveLength(2);
    expect(readStreamEventListeners(env)()).toEqual([
      { targetURL: "dvb://1", eventName: "now" },
      { targetURL: "dvb://1", eventName: "now" },
    ]);
  });

  it("removing takes away one subscription with that URL, name and listener", () => {
    const { env, unsubscribed } = setup();
    addStreamEventListener("dvb://1", "now", listener)(env)();
    addStreamEventListener("dvb://1", "now", other)(env)();
    addStreamEventListener("dvb://1", "now", listener)(env)();

    removeStreamEventListener("dvb://1", "now", listener)(env)();

    expect(unsubscribed).toEqual(["dvb://1#now#0"]);
    expect(readStreamEventListeners(env)()).toHaveLength(2);
  });

  it("removing what was never added changes nothing", () => {
    const { env, unsubscribed } = setup();
    addStreamEventListener("dvb://1", "now", listener)(env)();

    removeStreamEventListener("dvb://1", "later", listener)(env)();
    removeStreamEventListener("dvb://1", "now", other)(env)();

    expect(unsubscribed).toEqual([]);
    expect(readStreamEventListeners(env)()).toHaveLength(1);
  });

  it("the object drops them all, once each (TS 102 796 §8.2.1.1)", () => {
    const { env, unsubscribed } = setup();
    addStreamEventListener("dvb://1", "now", listener)(env)();
    addStreamEventListener("dvb://1", "later", other)(env)();

    dropStreamEventListeners(env)();
    dropStreamEventListeners(env)();

    expect(unsubscribed).toEqual(["dvb://1#now#0", "dvb://1#later#1"]);
    expect(readStreamEventListeners(env)()).toEqual([]);
  });
});

describe("stream events described over HTTP (TS 102 796 §8.2.1.1, §9.3.1)", () => {
  const url = "http://tv/it/default.ste";

  it("subscribes once the description names the event", async () => {
    const { env, subscribed } = setup(fetchFrom({ [url]: served(DESCRIPTION) }));
    const { events, listener } = recording();

    addStreamEventListener(url, "sevent", listener)(env)();
    expect(subscribed).toEqual([]);
    await settled();

    expect(subscribed).toEqual([`${url}#sevent#0`]);
    expect(events).toEqual([]);
  });

  it("a relative URL is relative to the document, and the schedule's events are the absolute URL's", async () => {
    const { env, subscribed } = setup(fetchFrom({ "http://tv/app/events.ste": served(DESCRIPTION) }));

    addStreamEventListener("events.ste", "sevent", listener)(env)();
    await settled();

    expect(subscribed).toEqual(["http://tv/app/events.ste#sevent#0"]);
    expect(readStreamEventListeners(env)()).toEqual([{ targetURL: "events.ste", eventName: "sevent" }]);
  });

  it.each([
    ["the description does not name the event", fetchFrom({ [url]: served(DESCRIPTION) }), "other"],
    ["the description cannot be fetched", fetchFrom({}), "sevent"],
    ["the file is not XML", fetchFrom({ [url]: served("not xml <") }), "sevent"],
    ["the file is not a DSM-CC description", fetchFrom({ [url]: served("<html/>") }), "sevent"],
    [
      "the event's id is not an unsigned short",
      fetchFrom({ [url]: served(DESCRIPTION.replace('stream_event_id="1"', 'stream_event_id="70000"')) }),
      "sevent",
    ],
  ])("an error event reaches the listener when %s (§8.2.1.2)", async (_, fetchDescription, eventName) => {
    const { env, subscribed } = setup(fetchDescription);
    const { events, listener } = recording();

    addStreamEventListener(url, eventName, listener)(env)();
    await settled();

    expect(subscribed).toEqual([]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ name: eventName, data: "", text: "", status: "error" });
  });

  it("a listener removed while its description is fetched hears nothing and is not subscribed", async () => {
    const { env, subscribed } = setup(fetchFrom({}));
    const { events, listener } = recording();

    addStreamEventListener(url, "sevent", listener)(env)();
    removeStreamEventListener(url, "sevent", listener)(env)();
    addStreamEventListener("http://tv/missing.ste", "sevent", other)(env)();
    dropStreamEventListeners(env)();
    await settled();

    expect(subscribed).toEqual([]);
    expect(events).toEqual([]);
  });

  it("dropping them unsubscribes those already described", async () => {
    const { env, unsubscribed } = setup(fetchFrom({ [url]: served(DESCRIPTION) }));
    addStreamEventListener(url, "sevent", listener)(env)();
    await settled();

    dropStreamEventListeners(env)();

    expect(unsubscribed).toEqual([`${url}#sevent#0`]);
  });
});
