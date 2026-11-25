import { isRight } from "fp-ts/Either";
import { describe, expect, it } from "vitest";
import { type AitApplication, AitCodec, autostartApplication, channelSignalling, signalsApplication } from "./ait";

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
  const plain = { id: "plain" };

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
