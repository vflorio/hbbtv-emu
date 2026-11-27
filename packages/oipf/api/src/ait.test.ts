import { isRight } from "fp-ts/Either";
import { describe, expect, it } from "vitest";
import {
  type AitApplication,
  AitCodec,
  applicationLocation,
  autostartApplication,
  channelSignalling,
  parseDvbApplicationUrl,
  signalledApplication,
  signalsApplication,
} from "./ait";

const app = (url: string, overrides: Partial<AitApplication> = {}): AitApplication => ({
  orgId: 1,
  appId: 1,
  controlCode: "AUTOSTART",
  url,
  ...overrides,
});

const channel = (id: string, ...applications: AitApplication[]) => ({ id, ait: { applications } });

describe("AIT codec", () => {
  it("accepts a decoded AIT and rejects unknown control codes", () => {
    expect(isRight(AitCodec.decode({ applications: [app("http://a.example/")] }))).toBe(true);
    expect(
      isRight(AitCodec.decode({ applications: [app("http://a.example/", { controlCode: "PREFETCH" as never })] })),
    ).toBe(false);
  });
});

describe("autostartApplication", () => {
  it("is the AUTOSTART application with the highest priority", () => {
    const low = app("http://low.example/", { priority: 1 });
    const high = app("http://high.example/", { priority: 5 });
    const present = app("http://present.example/", { controlCode: "PRESENT", priority: 9 });

    expect(autostartApplication({ applications: [low, present, high] })).toBe(high);
  });

  it("is the first signalled among equal priorities (0 when not given)", () => {
    const first = app("http://first.example/");
    const second = app("http://second.example/", { priority: 0 });

    expect(autostartApplication({ applications: [first, second] })).toBe(first);
  });

  it("is null when nothing is signalled as AUTOSTART", () => {
    expect(autostartApplication(undefined)).toBeNull();
    expect(autostartApplication({ applications: [app("http://a.example/", { controlCode: "PRESENT" })] })).toBeNull();
  });
});

describe("signalsApplication", () => {
  it("is whether the AIT signals that organisation's application as runnable, wherever it is loaded from", () => {
    const ait = {
      applications: [
        app("http://a.example/", { orgId: 10, appId: 1, controlCode: "PRESENT" }),
        app("http://b.example/", { orgId: 10, appId: 2, controlCode: "KILL" }),
      ],
    };

    expect(signalsApplication(ait, { orgId: 10, appId: 1 })).toBe(true);
    expect(signalsApplication(ait, { orgId: 10, appId: 2 })).toBe(false);
    expect(signalsApplication(ait, { orgId: 11, appId: 1 })).toBe(false);
    expect(signalsApplication(undefined, { orgId: 10, appId: 1 })).toBe(false);
  });
});

describe("channelSignalling", () => {
  const news = channel("news", app("http://apps.example/news/index.html"));
  const sport = channel("sport", app("http://apps.example/sport/index.html"));
  const plain = { id: "plain", ait: undefined };

  it("is the channel signalling the page's own URL, fragment aside", () => {
    expect(channelSignalling([plain, news, sport], "http://apps.example/sport/index.html#menu")).toBe(sport);
  });

  it("prefers the page's own URL to a channel whose application only shares its origin", () => {
    // `news` comes first and shares the origin, but `sport` signals this very page.
    expect(channelSignalling([news, sport], "http://apps.example/sport/index.html")).toBe(sport);
  });

  it("falls back to the first channel whose application boundary (its origin) holds the page", () => {
    expect(channelSignalling([plain, news, sport], "http://apps.example/news/detail.html?id=3")).toBe(news);
  });

  it("ignores applications that may not run, and other origins", () => {
    const killed = channel("killed", app("http://apps.example/", { controlCode: "KILL" }));
    const disabled = channel("disabled", app("http://apps.example/", { controlCode: "DISABLED" }));
    const present = channel("present", app("http://apps.example/", { controlCode: "PRESENT" }));

    expect(channelSignalling([killed, disabled, present], "http://apps.example/")).toBe(present);
    expect(channelSignalling([news], "https://apps.example/news/index.html")).toBeNull();
    expect(channelSignalling([plain], "http://apps.example/")).toBeNull();
  });

  it("ignores URLs it cannot parse", () => {
    expect(channelSignalling([channel("broken", app("not a url"))], "http://apps.example/")).toBeNull();
    expect(channelSignalling([news], "not a url")).toBeNull();
  });
});

describe("parseDvbApplicationUrl", () => {
  it("names an application of the current service's AIT, its ids in hexadecimal (TS 102 812 §14.5)", () => {
    expect(parseDvbApplicationUrl("dvb://current.ait/1.1")).toEqual({
      _tag: "current",
      id: { orgId: 1, appId: 1 },
      query: null,
      fragment: null,
    });
    expect(parseDvbApplicationUrl("dvb://current.ait/13.1a?param2=value2#foo")).toEqual({
      _tag: "current",
      id: { orgId: 0x13, appId: 0x1a },
      query: "param2=value2",
      fragment: "foo",
    });
    expect(parseDvbApplicationUrl("DVB://CURRENT.AIT/FF.A")).toMatchObject({ id: { orgId: 0xff, appId: 0xa } });
  });

  it("tells an application of another service apart, and names nothing otherwise", () => {
    expect(parseDvbApplicationUrl("dvb://233a.4.5.ait/1.1")).toEqual({ _tag: "otherService" });
    expect(parseDvbApplicationUrl("dvb://current.ait/app_root")).toBeNull();
    expect(parseDvbApplicationUrl("dvb://1.2.3/index.html")).toBeNull();
    expect(parseDvbApplicationUrl("http://apps.example/")).toBeNull();
  });
});

describe("signalledApplication", () => {
  it("is the runnable application with that id", () => {
    const present = app("http://present.example/", { orgId: 10, appId: 2, controlCode: "PRESENT" });
    const killed = app("http://killed.example/", { orgId: 10, appId: 3, controlCode: "KILL" });
    const ait = { applications: [present, killed] };

    expect(signalledApplication(ait, { orgId: 10, appId: 2 })).toBe(present);
    expect(signalledApplication(ait, { orgId: 10, appId: 3 })).toBeNull();
    expect(signalledApplication(undefined, { orgId: 10, appId: 2 })).toBeNull();
  });
});

describe("applicationLocation", () => {
  // The examples of TS 102 796 §9.2.
  it("appends the dvb: URL's query to the signalled one with &", () => {
    expect(
      applicationLocation("http://www.example.com/app1?param1=value1", { query: "param2=value2", fragment: "foo" }),
    ).toBe("http://www.example.com/app1?param1=value1&param2=value2#foo");
  });

  it("gives the dvb: URL's fragment precedence over the signalled one", () => {
    expect(
      applicationLocation("http://www.example.com/app1?param1=value1#test", { query: null, fragment: "foo" }),
    ).toBe("http://www.example.com/app1?param1=value1#foo");
  });

  it("keeps what only one of them has", () => {
    expect(applicationLocation("http://www.example.com/app1#test", { query: "a=1", fragment: null })).toBe(
      "http://www.example.com/app1?a=1#test",
    );
    expect(applicationLocation("http://www.example.com/app1", { query: null, fragment: null })).toBe(
      "http://www.example.com/app1",
    );
  });
});
