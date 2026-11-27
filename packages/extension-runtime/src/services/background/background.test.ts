import { type BootstrapData, configBootstrapScript, type HostMessage } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { describe, expect, it } from "vitest";
import {
  createFakeMessaging,
  createFakePageBootstrap,
  createFakeStorage,
  createFakeTabs,
  createFakeUi,
  createFakeUserAgent,
  createFakeWebRequest,
  flushPromises,
  silentLogger,
} from "../../__tests__/fakes";
import type { BroadbandAdapter } from "../../adapter";
import { DEFAULT_STATE, type ExtensionState, type TvSessions, toPageConfig, toUiState } from "../../state";
import { BackgroundService } from "./background";

/** Tab 1 is the active one (where the side panel is), tab 2 is in the background. */
const OPEN_TABS = [
  { id: 1, url: "http://app/a.xhtml" },
  { id: 2, url: "http://app/b.xhtml" },
];

const setup = async (
  stored?: ExtensionState,
  openTabs = OPEN_TABS,
  bootstrapAvailable = true,
  storedSessions?: TvSessions,
  broadband: BroadbandAdapter = { fetchText: (url) => TE.left({ _tag: "BroadbandFetchError", url, cause: null }) },
) => {
  const messaging = createFakeMessaging<HostMessage>();
  const tabs = createFakeTabs(openTabs);
  const sessionStorage = createFakeStorage<TvSessions>(storedSessions);
  const ui = createFakeUi();
  const userAgent = createFakeUserAgent();
  const bootstrap = createFakePageBootstrap(bootstrapAvailable);
  const background = new BackgroundService({
    config: { engine: "chrome", manifest: 3, storageKey: "test" },
    logger: silentLogger(),
    adapter: {
      storage: createFakeStorage<ExtensionState>(stored).storage,
      sessionStorage: sessionStorage.storage,
      messaging: messaging.messaging,
      tabs: tabs.tabs,
      webRequest: createFakeWebRequest().webRequest,
      ui: ui.ui,
      userAgent: userAgent.userAgent,
      pageBootstrap: bootstrap.pageBootstrap,
      broadband,
      assets: { url: assetUrl },
    },
  });
  expect(E.isRight(await background.init()())).toBe(true);
  return { background, messaging, ui, userAgent, bootstrap, tabs, sessionStorage };
};

/** The extension's URL of a file it ships. */
const assetUrl = (path: string) => `chrome-extension://emu/${path}`;

describe("BackgroundService", () => {
  it("sends the configuration, then the tab's TV session, to a page runtime that announces itself", async () => {
    const { messaging } = await setup();

    messaging.receive({ _tag: "Page/Ready", url: "http://app" }, 7);
    await flushPromises();

    expect(messaging.sent).toEqual([
      { tabId: 7, message: { _tag: "Host/Config", config: toPageConfig(DEFAULT_STATE, assetUrl) } },
      {
        tabId: 7,
        // The channel as pages get it: its stream at the extension's URL.
        message: {
          _tag: "Host/Session",
          session: { channel: toPageConfig(DEFAULT_STATE, assetUrl).channels[0], volume: 100 },
        },
      },
    ]);
  });

  it("sends the persisted configuration, not the defaults", async () => {
    const stored = { ...DEFAULT_STATE, runtime: { ...DEFAULT_STATE.runtime, userAgent: "Custom TV/1.0" } };
    const { messaging } = await setup(stored);

    messaging.receive({ _tag: "Page/Ready", url: "http://app" }, 7);
    await flushPromises();

    expect(messaging.sent[0]?.message).toMatchObject({ _tag: "Host/Config", config: { userAgent: "Custom TV/1.0" } });
  });

  it("never pushes OIPF object state to the page (it would wipe what the application did)", async () => {
    const { messaging } = await setup();

    messaging.receive({ _tag: "Page/Ready", url: "http://app" }, 7);
    await flushPromises();

    const config = (messaging.sent[0]?.message as Extract<HostMessage, { _tag: "Host/Config" }>).config;
    expect(Object.keys(config).sort()).toEqual(["channels", "userAgent"]);
  });

  it("makes the browser send the stored user agent before any page loads", async () => {
    const stored = { ...DEFAULT_STATE, runtime: { ...DEFAULT_STATE.runtime, userAgent: "Custom TV/1.0" } };
    const { userAgent } = await setup(stored);

    expect(userAgent.applied).toEqual(["Custom TV/1.0"]);
  });

  it("fetches a stream event description for the page that asks, as a TV does (TS 102 796 §8.2.1.1)", async () => {
    const files: Record<string, string> = { "http://tv/a.ste": "<dsmcc/>" };
    const broadband: BroadbandAdapter = {
      fetchText: (url) =>
        files[url] === undefined
          ? TE.left({ _tag: "BroadbandFetchError", url, cause: new Error("HTTP 404") })
          : TE.right({ contentType: "application/vnd.dvb.streamevent+xml", body: files[url] }),
    };
    const { messaging } = await setup(undefined, OPEN_TABS, true, undefined, broadband);

    messaging.receive({ _tag: "Page/FetchStreamEventDescription", url: "http://tv/a.ste" }, 7);
    messaging.receive({ _tag: "Page/FetchStreamEventDescription", url: "http://tv/missing.ste" }, 2);
    await flushPromises();

    expect(messaging.sent).toEqual([
      {
        tabId: 7,
        message: {
          _tag: "Host/StreamEventDescription",
          url: "http://tv/a.ste",
          result: { ok: true, contentType: "application/vnd.dvb.streamevent+xml", body: "<dsmcc/>" },
        },
      },
      {
        tabId: 2,
        message: {
          _tag: "Host/StreamEventDescription",
          url: "http://tv/missing.ste",
          result: { ok: false, reason: "HTTP 404" },
        },
      },
    ]);
  });

  it("ignores messages that are not from a page runtime", async () => {
    const { messaging } = await setup();

    messaging.receive({ _tag: "Something/Else" }, 7);
    await flushPromises();

    expect(messaging.sent).toEqual([]);
  });
});

describe("BackgroundService — configuration bootstrap", () => {
  const stored = { ...DEFAULT_STATE, runtime: { ...DEFAULT_STATE.runtime, userAgent: "Custom TV/1.0" } };
  const [first] = DEFAULT_STATE.runtime.channels;
  const hgtv = { ...first!, id: "hgtv", name: "HGTV", sid: 56 };
  const lineup = { ...DEFAULT_STATE, runtime: { ...DEFAULT_STATE.runtime, channels: [first!, hgtv] } };
  const script = (state: ExtensionState, tunings: BootstrapData["tunings"] = []) =>
    configBootstrapScript({ config: toPageConfig(state, assetUrl), tunings });

  it("publishes the configuration for pages to find at document_start, before any page loads", async () => {
    const { bootstrap } = await setup(stored);

    expect(bootstrap.published).toEqual([script(stored)]);
  });

  it("publishes it again when the configuration changes", async () => {
    const { ui, bootstrap } = await setup();
    const saved = { ...toUiState(DEFAULT_STATE), userAgent: "Custom TV/1.0" };

    await ui.request({ _tag: "UI/SaveState", state: saved });

    expect(bootstrap.published[bootstrap.published.length - 1]).toContain("Custom TV/1.0");
  });

  it("when not allowed, still starts, and retries when a page loads (the user may have allowed it since)", async () => {
    const { messaging, bootstrap } = await setup(stored, OPEN_TABS, false);
    expect(bootstrap.published).toEqual([]);

    bootstrap.setAvailable(true);
    messaging.receive({ _tag: "Page/Ready", url: "http://app/" }, 7);
    await flushPromises();

    expect(bootstrap.published).toEqual([script(stored, [{ url: "http://app/", channelId: first!.id }])]);
  });

  it("tells pages which channel the TV showing them is on: a reload finds it at document_start", async () => {
    const { messaging, ui, bootstrap } = await setup(lineup);
    messaging.receive({ _tag: "Page/Ready", url: "http://app/a.xhtml" }, 1);
    await flushPromises();

    await ui.request({ _tag: "UI/PlayChannel", channel: hgtv });

    expect(bootstrap.published).toEqual([
      script(lineup),
      script(lineup, [{ url: "http://app/a.xhtml", channelId: first!.id }]),
      script(lineup, [{ url: "http://app/a.xhtml", channelId: "hgtv" }]),
    ]);
  });

  it("publishes only when what pages get changes, and forgets the tuning of a closed tab", async () => {
    const { messaging, bootstrap, tabs } = await setup(lineup);
    const ready = async () => {
      messaging.receive({ _tag: "Page/Ready", url: "http://app/a.xhtml" }, 1);
      await flushPromises();
    };

    await ready();
    await ready(); // a reload: same page, same channel
    expect(bootstrap.published).toHaveLength(2);

    tabs.close(1);
    await flushPromises();
    expect(bootstrap.published).toEqual([
      script(lineup),
      script(lineup, [{ url: "http://app/a.xhtml", channelId: first!.id }]),
      script(lineup),
    ]);
  });
});

describe("default configuration", () => {
  it("has a real user agent and the default channel lineup", () => {
    const config = toPageConfig(DEFAULT_STATE, assetUrl);

    expect(config.userAgent).toContain("HbbTV/");
    expect(config.channels.length).toBeGreaterThan(0);
  });

  it("broadcasts the test card the extension ships, at the extension's URL: no external service", () => {
    expect(DEFAULT_STATE.runtime.channels.map((channel) => channel.mp4Source)).toEqual(
      DEFAULT_STATE.runtime.channels.map(() => "hbbtv-emu:broadcast/test-card.mp4"),
    );
    expect(toPageConfig(DEFAULT_STATE, assetUrl).channels.map((channel) => channel.mp4Source)).toEqual(
      DEFAULT_STATE.runtime.channels.map(() => "chrome-extension://emu/broadcast/test-card.mp4"),
    );
  });
});

describe("BackgroundService — settings UI", () => {
  const uiState = toUiState(DEFAULT_STATE);

  it("returns the current state", async () => {
    const { ui } = await setup();

    expect(await ui.request({ _tag: "UI/GetState" })).toEqual({ _tag: "UI/State", state: uiState });
  });

  it("a configuration change is persisted, sent to every open tab and announced to the UIs", async () => {
    const { ui, messaging, userAgent } = await setup();
    const saved = { ...uiState, userAgent: "Custom TV/1.0" };

    expect(await ui.request({ _tag: "UI/SaveState", state: saved })).toEqual({ _tag: "UI/Done" });

    expect(messaging.sent.map((s) => [s.tabId, s.message._tag])).toEqual([
      [1, "Host/Config"],
      [2, "Host/Config"],
    ]);
    expect(ui.notified).toEqual([{ _tag: "UI/StateChanged", state: saved }]);
    expect(userAgent.applied).toEqual([DEFAULT_STATE.runtime.userAgent, "Custom TV/1.0"]);
    expect(await ui.request({ _tag: "UI/GetState" })).toEqual({ _tag: "UI/State", state: saved });
  });

  it("an object-state edit becomes a minimal patch for the active tab only", async () => {
    const { ui, messaging } = await setup();
    const saved = {
      ...uiState,
      hbbtv: { ...uiState.hbbtv, videoBroadcast: { ...uiState.hbbtv.videoBroadcast, volume: 30 } },
    };

    await ui.request({ _tag: "UI/SaveState", state: saved });

    expect(messaging.sent).toEqual([
      { tabId: 1, message: { _tag: "Host/ApplyState", patch: { videoBroadcast: { volume: 30 } } } },
    ]);
  });

  it("saving an unchanged state sends nothing to the pages", async () => {
    const { ui, messaging, userAgent } = await setup();

    await ui.request({ _tag: "UI/SaveState", state: uiState });

    expect(messaging.sent).toEqual([]);
    expect(userAgent.applied).toHaveLength(1); // only the one at start
  });

  it("remote-control keys go to the active tab", async () => {
    const { ui, messaging } = await setup();

    expect(await ui.request({ _tag: "UI/DispatchKey", keyCode: 403 })).toEqual({ _tag: "UI/Done" });
    expect(messaging.sent).toEqual([{ tabId: 1, message: { _tag: "Host/DispatchKey", keyCode: 403 } }]);
  });

  it("reports when there is no tab to send a key to", async () => {
    const { ui } = await setup(undefined, []);

    expect(await ui.request({ _tag: "UI/DispatchKey", keyCode: 403 })).toEqual({
      _tag: "UI/Failed",
      reason: "No active tab",
    });
  });

  it("ignores messages that are not UI requests", async () => {
    const { ui } = await setup();

    expect(await ui.request({ _tag: "Page/Ready", url: "x" })).toBe("ignored");
  });
});

describe("BackgroundService — TV sessions (one per tab)", () => {
  const [first] = DEFAULT_STATE.runtime.channels;
  const dmax = { ...first!, id: "dmax", name: "DMAX", sid: 52 };
  const hgtv = { ...first!, id: "hgtv", name: "HGTV", sid: 56 };
  const lineup = { ...DEFAULT_STATE, runtime: { ...DEFAULT_STATE.runtime, channels: [dmax, hgtv] } };

  type Sent = { tabId: number; message: HostMessage };
  const tunedTo = (sent: ReadonlyArray<Sent>, tabId: number) =>
    sent
      .filter((s) => s.tabId === tabId && s.message._tag === "Host/Session")
      .map((s) => (s.message as Extract<HostMessage, { _tag: "Host/Session" }>).session.channel?.id ?? null);

  const pageReady = async (
    messaging: { receive: (m: object, tabId: number) => void },
    tabId: number,
    url = "http://app/index.xhtml",
  ) => {
    messaging.receive({ _tag: "Page/Ready", url }, tabId);
    await flushPromises();
  };

  it("the first HbbTV page of a tab opens a TV session on the first channel of the lineup", async () => {
    const { messaging } = await setup(lineup);

    await pageReady(messaging, 1);

    expect(tunedTo(messaging.sent, 1)).toEqual(["dmax"]);
  });

  it("…or on the channel whose AIT signals the application, if one does", async () => {
    const signalling = (url: string) => ({
      applications: [{ orgId: 10, appId: 1, controlCode: "AUTOSTART" as const, url }],
    });
    const withAit = {
      ...lineup,
      runtime: {
        ...lineup.runtime,
        channels: [
          { ...dmax, ait: signalling("http://dmax.example/app/index.html") },
          { ...hgtv, ait: signalling("http://hgtv.example/app/index.html") },
        ],
      },
    };
    const { messaging } = await setup(withAit);

    await pageReady(messaging, 1, "http://hgtv.example/app/index.html");
    await pageReady(messaging, 2, "http://elsewhere.example/");

    expect(tunedTo(messaging.sent, 1)).toEqual(["hgtv"]);
    expect(tunedTo(messaging.sent, 2)).toEqual(["dmax"]);
  });

  it("once open, the session keeps its channel whatever page the tab loads next", async () => {
    const withAit = {
      ...lineup,
      runtime: {
        ...lineup.runtime,
        channels: [
          dmax,
          {
            ...hgtv,
            ait: {
              applications: [{ orgId: 10, appId: 1, controlCode: "AUTOSTART" as const, url: "http://hgtv.example/" }],
            },
          },
        ],
      },
    };
    const { messaging } = await setup(withAit);

    await pageReady(messaging, 1);
    await pageReady(messaging, 1, "http://hgtv.example/");

    expect(tunedTo(messaging.sent, 1)).toEqual(["dmax", "dmax"]);
  });

  it("a tab opened on the page another TV shows starts on that TV's channel, as the page itself does", async () => {
    const { messaging, ui } = await setup(lineup);
    await pageReady(messaging, 1);
    await ui.request({ _tag: "UI/PlayChannel", channel: hgtv });

    await pageReady(messaging, 2);

    expect(tunedTo(messaging.sent, 2)).toEqual(["hgtv"]);
  });

  it("the UI tunes the TV in the active tab, which the page follows", async () => {
    const { messaging, ui } = await setup(lineup);
    await pageReady(messaging, 1);

    expect(await ui.request({ _tag: "UI/PlayChannel", channel: hgtv })).toEqual({ _tag: "UI/Done" });

    expect(tunedTo(messaging.sent, 1)).toEqual(["dmax", "hgtv"]);
    // The UI showed the tab's TV as soon as its page opened the session, then followed it.
    expect(ui.notified).toEqual([
      { _tag: "UI/StateChanged", state: toUiState(lineup, dmax) },
      { _tag: "UI/StateChanged", state: toUiState(lineup, hgtv) },
    ]);
  });

  it("P+/P- on the UI's remote retune an application opened on its own, as Play does", async () => {
    const { messaging, ui } = await setup(lineup);
    await pageReady(messaging, 1);

    await ui.request({ _tag: "UI/DispatchKey", keyCode: 428 });
    await ui.request({ _tag: "UI/DispatchKey", keyCode: 428 });

    expect(tunedTo(messaging.sent, 1)).toEqual(["dmax", "hgtv", "dmax"]);
  });

  it("VOL+/VOL- on the UI's remote change the volume of the active tab's TV, within 0–100, never the application's keys", async () => {
    const { messaging, ui } = await setup(lineup);
    await pageReady(messaging, 1);
    const volumes = () =>
      messaging.sent
        .filter((s) => s.tabId === 1 && s.message._tag === "Host/Session")
        .map((s) => (s.message as Extract<HostMessage, { _tag: "Host/Session" }>).session.volume);

    for (const keyCode of [447, 448, 448]) {
      expect(await ui.request({ _tag: "UI/DispatchKey", keyCode })).toEqual({ _tag: "UI/Done" });
    }

    // Starts at full volume: VOL+ cannot go above it.
    expect(volumes()).toEqual([100, 100, 95, 90]);
    expect(messaging.sent.filter((s) => s.message._tag === "Host/DispatchKey")).toEqual([]);
  });

  it("the TV's volume outlives the pages of its tab", async () => {
    const { messaging, ui } = await setup(lineup);
    await pageReady(messaging, 1);
    await ui.request({ _tag: "UI/DispatchKey", keyCode: 448 });

    await pageReady(messaging, 1, "http://app/next.xhtml");

    const sessions = messaging.sent.filter((s) => s.tabId === 1 && s.message._tag === "Host/Session");
    expect(sessions[sessions.length - 1]?.message).toMatchObject({ session: { volume: 95 } });
  });

  it("P+/P- and VOL+/VOL- pressed on a page's keyboard act on the TV of that page's tab, active or not", async () => {
    const { messaging, tabs } = await setup(lineup, [
      { id: 1, url: "http://app/index.xhtml" },
      { id: 2, url: "http://app/other.xhtml" },
    ]);
    await pageReady(messaging, 1);
    await pageReady(messaging, 2, "http://app/other.xhtml");
    tabs.activate(1);
    await flushPromises();
    const sessionsOf = (tabId: number) =>
      messaging.sent
        .filter((s) => s.tabId === tabId && s.message._tag === "Host/Session")
        .map((s) => (s.message as Extract<HostMessage, { _tag: "Host/Session" }>).session);

    messaging.receive({ _tag: "Page/TvKey", keyCode: 427 }, 2);
    await flushPromises();
    messaging.receive({ _tag: "Page/TvKey", keyCode: 448 }, 2);
    await flushPromises();
    // Not a key of the TV: nothing happens.
    messaging.receive({ _tag: "Page/TvKey", keyCode: 403 }, 2);
    await flushPromises();

    expect(sessionsOf(2).map((session) => [session.channel?.id, session.volume])).toEqual([
      ["dmax", 100],
      ["hgtv", 100],
      ["hgtv", 95],
    ]);
    expect(sessionsOf(1)).toHaveLength(1);
    expect(messaging.sent.filter((s) => s.message._tag === "Host/DispatchKey")).toEqual([]);
  });

  it("P+ is refused for a tab that is not a TV", async () => {
    const { ui } = await setup(lineup);

    expect(await ui.request({ _tag: "UI/DispatchKey", keyCode: 427 })).toEqual({
      _tag: "UI/Failed",
      reason: "The active tab does not run the emulator (tab 1)",
    });
  });

  it("the UI follows the active tab: switching to another TV shows its channel, to a plain tab none", async () => {
    const { messaging, ui, tabs } = await setup(lineup, [
      { id: 1, url: "http://app/index.xhtml" },
      { id: 2, url: "http://app/other.xhtml" },
      { id: 3, url: "http://example.com/" },
    ]);
    await pageReady(messaging, 1);
    await ui.request({ _tag: "UI/PlayChannel", channel: hgtv });
    await pageReady(messaging, 2, "http://app/other.xhtml");
    ui.notified.splice(0);

    tabs.activate(2);
    await flushPromises();
    tabs.activate(3);
    await flushPromises();
    tabs.activate(1);
    await flushPromises();

    expect(ui.notified).toEqual([
      { _tag: "UI/StateChanged", state: toUiState(lineup, dmax) },
      { _tag: "UI/StateChanged", state: toUiState(lineup, null) },
      { _tag: "UI/StateChanged", state: toUiState(lineup, hgtv) },
    ]);
  });

  it("the session outlives the pages of its tab, and is not shared with other tabs", async () => {
    const { messaging, ui } = await setup(lineup);
    await pageReady(messaging, 1);
    await ui.request({ _tag: "UI/PlayChannel", channel: hgtv });

    await pageReady(messaging, 1); // a navigation or a reload in the same tab
    await pageReady(messaging, 2, "http://app/other.xhtml");

    expect(tunedTo(messaging.sent, 1)).toEqual(["dmax", "hgtv", "hgtv"]);
    expect(tunedTo(messaging.sent, 2)).toEqual(["dmax"]);
  });

  it("closing the tab ends its session", async () => {
    const { messaging, ui, tabs } = await setup(lineup);
    await pageReady(messaging, 1);
    await ui.request({ _tag: "UI/PlayChannel", channel: hgtv });

    tabs.close(1);
    await flushPromises();
    await pageReady(messaging, 1);

    expect(tunedTo(messaging.sent, 1)).toEqual(["dmax", "hgtv", "dmax"]);
  });

  it("a restarted background (MV3 service worker) finds the sessions of the tabs still open", async () => {
    const stored = {
      // As an older version stored it: it always selected the channel's service.
      "1": { mode: "app", channelId: "hgtv", url: null, app: null, volume: 100 },
      "99": { mode: "app", channelId: "hgtv", serviceSelected: true, url: null, app: null, volume: 100 },
    } as unknown as TvSessions;
    const { messaging, sessionStorage } = await setup(lineup, OPEN_TABS, true, stored);

    await pageReady(messaging, 1);

    expect(tunedTo(messaging.sent, 1)).toEqual(["hgtv"]);
    expect(Object.keys(sessionStorage.stored() ?? {})).toEqual(["1"]);
  });

  it("drops stored sessions it does not understand", async () => {
    const stored = { "1": { mode: "tv-from-the-future", channel: 3 } } as unknown as TvSessions;
    const { messaging } = await setup(lineup, OPEN_TABS, true, stored);

    await pageReady(messaging, 1);

    expect(tunedTo(messaging.sent, 1)).toEqual(["dmax"]);
  });

  it("a session whose channel left the lineup is back on the first channel", async () => {
    const stored: TvSessions = {
      "1": { mode: "app", channelId: "gone", serviceSelected: true, url: null, app: null, volume: 100 },
    };
    const { messaging } = await setup(lineup, OPEN_TABS, true, stored);

    await pageReady(messaging, 1);

    expect(tunedTo(messaging.sent, 1)).toEqual(["dmax"]);
  });

  it("the UI shows the channel of the active tab's TV, none if that tab is not a TV", async () => {
    const { messaging, ui } = await setup(lineup);
    expect(await ui.request({ _tag: "UI/GetState" })).toEqual({ _tag: "UI/State", state: toUiState(lineup, null) });

    await pageReady(messaging, 1);

    expect(await ui.request({ _tag: "UI/GetState" })).toEqual({ _tag: "UI/State", state: toUiState(lineup, dmax) });
  });

  it("the UI cannot tune a tab that is not a TV", async () => {
    const { messaging, ui } = await setup(lineup);

    expect(await ui.request({ _tag: "UI/PlayChannel", channel: hgtv })).toEqual({
      _tag: "UI/Failed",
      reason: "The active tab does not run the emulator (tab 1)",
    });
    expect(messaging.sent).toEqual([]);
  });

  it("the UI cannot tune to a channel outside the lineup", async () => {
    const { messaging, ui } = await setup(lineup);
    await pageReady(messaging, 1);

    expect(await ui.request({ _tag: "UI/PlayChannel", channel: { ...hgtv, id: "nope" } })).toEqual({
      _tag: "UI/Failed",
      reason: "Unknown channel: nope",
    });
  });
});

describe("BackgroundService — TV mode (turned on from the UI)", () => {
  const [first] = DEFAULT_STATE.runtime.channels;
  const app = (orgId: number, appId: number, url: string) => ({
    applications: [{ orgId, appId, controlCode: "AUTOSTART" as const, url }],
  });
  // DMAX and HGTV signal the same application (org 10, app 1) from different URLs;
  // NEWS signals another one; RADIO none.
  const dmax = { ...first!, id: "dmax", sid: 52, ait: app(10, 1, "http://linear.example/dmax.html") };
  const hgtv = { ...first!, id: "hgtv", sid: 56, ait: app(10, 1, "http://linear.example/hgtv.html") };
  const news = { ...first!, id: "news", sid: 60, ait: app(20, 1, "http://news.example/") };
  const radio = { ...first!, id: "radio", sid: 70 };
  const lineup = { ...DEFAULT_STATE, runtime: { ...DEFAULT_STATE.runtime, channels: [dmax, hgtv, news, radio] } };
  const TV_TAB = 100; // the first tab the fake creates

  type Sent = { tabId: number; message: HostMessage };
  const sessionsSent = (sent: ReadonlyArray<Sent>, tabId: number) =>
    sent
      .filter((s) => s.tabId === tabId && s.message._tag === "Host/Session")
      .map((s) => (s.message as Extract<HostMessage, { _tag: "Host/Session" }>).session.channel?.id ?? null);

  const turnOn = async (channelId: string) => {
    const env = await setup(lineup);
    expect(await env.ui.request({ _tag: "UI/TurnOnTv", channelId })).toEqual({ _tag: "UI/Done" });
    return env;
  };

  it("turns on a new tab on the channel's autostart application, its channel already in the bootstrap", async () => {
    const { tabs, bootstrap, messaging } = await turnOn("hgtv");

    expect(tabs.navigations).toEqual([
      { tabId: TV_TAB, url: "about:blank" },
      { tabId: TV_TAB, url: "http://linear.example/hgtv.html" },
    ]);
    expect(bootstrap.published[bootstrap.published.length - 1]).toBe(
      configBootstrapScript({
        config: toPageConfig(lineup, assetUrl),
        tunings: [{ url: "http://linear.example/hgtv.html", channelId: "hgtv" }],
      }),
    );

    messaging.receive({ _tag: "Page/Ready", url: "http://linear.example/hgtv.html" }, TV_TAB);
    await flushPromises();
    expect(sessionsSent(messaging.sent, TV_TAB)).toEqual(["hgtv"]);
  });

  it("shows the TV page for a channel without application", async () => {
    const { tabs, ui } = await turnOn("radio");

    expect(tabs.navigations[1]).toEqual({ tabId: TV_TAB, url: "ext://hbb-emu/tv.html?channel=radio" });
    // The new tab is the active one: the UI shows its channel.
    expect(ui.notified).toEqual([{ _tag: "UI/StateChanged", state: toUiState(lineup, radio) }]);
  });

  it("does not turn on a TV on a channel outside the lineup", async () => {
    const { ui, tabs } = await setup(lineup);

    expect(await ui.request({ _tag: "UI/TurnOnTv", channelId: "nope" })).toEqual({
      _tag: "UI/Failed",
      reason: "Unknown channel: nope",
    });
    expect(tabs.navigations).toEqual([]);
  });

  it("on a channel that signals the running application, the application stays and retunes", async () => {
    const { ui, tabs, messaging } = await turnOn("dmax");

    expect(await ui.request({ _tag: "UI/PlayChannel", channel: hgtv })).toEqual({ _tag: "UI/Done" });

    expect(tabs.navigations).toHaveLength(2); // about:blank, then DMAX's page: nothing more
    expect(sessionsSent(messaging.sent, TV_TAB)).toEqual(["hgtv"]);
  });

  it("on any other channel, the tab loads its autostart application, or the TV page, after the page got the session", async () => {
    const { ui, tabs, messaging, bootstrap } = await turnOn("dmax");

    await ui.request({ _tag: "UI/PlayChannel", channel: news });
    expect(bootstrap.published[bootstrap.published.length - 1]).toContain('"channelId":"news"');
    await ui.request({ _tag: "UI/PlayChannel", channel: radio });
    await ui.request({ _tag: "UI/PlayChannel", channel: hgtv });

    expect(tabs.navigations.slice(2).map((n) => n.url)).toEqual([
      "http://news.example/",
      "ext://hbb-emu/tv.html?channel=radio",
      "http://linear.example/hgtv.html",
    ]);
    // As a TV tunes before the new service's AIT ends the application.
    expect(sessionsSent(messaging.sent, TV_TAB)).toEqual(["news", "radio", "hgtv"]);
  });

  it("P+/P- on the UI's remote zap through the lineup as the TV does, cycling at both ends", async () => {
    const { ui, tabs, messaging } = await turnOn("news");

    for (const keyCode of [427, 427, 427, 428]) {
      expect(await ui.request({ _tag: "UI/DispatchKey", keyCode })).toEqual({ _tag: "UI/Done" });
    }

    // news → radio → dmax (cycling) → hgtv, which signals DMAX's application: it stays → dmax.
    expect(sessionsSent(messaging.sent, TV_TAB)).toEqual(["radio", "dmax", "hgtv", "dmax"]);
    expect(tabs.navigations.slice(2).map((n) => n.url)).toEqual([
      "ext://hbb-emu/tv.html?channel=radio",
      "http://linear.example/dmax.html",
    ]);
    // The keys are the TV's: the application never gets them.
    expect(messaging.sent.filter((s) => s.message._tag === "Host/DispatchKey")).toEqual([]);
  });

  const errorsSent = (sent: ReadonlyArray<Sent>, tabId: number) =>
    sent.filter((s) => s.tabId === tabId && s.message._tag === "Host/ChannelChangeError").map((s) => s.message);

  const setChannel = async (
    messaging: { receive: (m: object, tabId: number) => void },
    tabId: number,
    channelId: string,
  ) => {
    messaging.receive({ _tag: "Page/SetChannel", channelId }, tabId);
    await flushPromises();
  };

  it("the application changes channel as the UI does: it stays on a channel that signals it", async () => {
    const env = await turnOn("dmax");
    env.ui.notified.splice(0);

    await setChannel(env.messaging, TV_TAB, "hgtv");

    expect(env.tabs.navigations).toHaveLength(2);
    expect(sessionsSent(env.messaging.sent, TV_TAB)).toEqual(["hgtv"]);
    expect(env.ui.notified).toEqual([{ _tag: "UI/StateChanged", state: toUiState(lineup, hgtv) }]);
  });

  it("…and the tab loads what any other channel shows, that channel already in the bootstrap", async () => {
    const { messaging, tabs, bootstrap } = await turnOn("dmax");
    // What the page had received when the tab started loading the new one.
    const sessionsAtNavigation: Array<ReadonlyArray<string | null>> = [];
    const navigate = tabs.tabs.navigate;
    Object.assign(tabs.tabs, {
      navigate: (tabId: number, url: string) => {
        sessionsAtNavigation.push(sessionsSent(messaging.sent, tabId));
        return navigate(tabId, url);
      },
    });

    await setChannel(messaging, TV_TAB, "news");

    // The application's setChannel() succeeds before its page goes.
    expect(sessionsAtNavigation).toEqual([["news"]]);

    expect(tabs.navigations[2]).toEqual({ tabId: TV_TAB, url: "http://news.example/" });
    expect(bootstrap.published[bootstrap.published.length - 1]).toContain('"channelId":"news"');
    expect(errorsSent(messaging.sent, TV_TAB)).toEqual([]);
  });

  it("an application opened on its own (app mode) keeps its channel: unknown channel", async () => {
    const { messaging, tabs } = await setup(lineup);
    messaging.receive({ _tag: "Page/Ready", url: "http://linear.example/dmax.html" }, 1);
    await flushPromises();

    await setChannel(messaging, 1, "hgtv");

    expect(errorsSent(messaging.sent, 1)).toEqual([{ _tag: "Host/ChannelChangeError", channelId: "hgtv", error: 5 }]);
    expect(sessionsSent(messaging.sent, 1)).toEqual(["dmax"]);
    expect(tabs.navigations).toEqual([]);
  });

  it("a channel outside the lineup is unknown", async () => {
    const { messaging, tabs } = await turnOn("dmax");

    await setChannel(messaging, TV_TAB, "nope");

    expect(errorsSent(messaging.sent, TV_TAB)).toEqual([
      { _tag: "Host/ChannelChangeError", channelId: "nope", error: 5 },
    ]);
    expect(tabs.navigations).toHaveLength(2);
  });

  const destroyApplication = async (messaging: { receive: (m: object, tabId: number) => void }, tabId: number) => {
    messaging.receive({ _tag: "Page/DestroyApplication" }, tabId);
    await flushPromises();
  };

  it("an application that exits is started again: the channel's AIT signals it as autostart (TS 102 796 §6.2.2.3)", async () => {
    const env = await turnOn("dmax");
    env.messaging.receive({ _tag: "Page/Ready", url: "http://linear.example/dmax.html" }, TV_TAB);
    await flushPromises();
    env.ui.notified.splice(0);

    await destroyApplication(env.messaging, TV_TAB);

    expect(env.tabs.navigations.slice(2)).toEqual([{ tabId: TV_TAB, url: "http://linear.example/dmax.html" }]);
    expect(env.ui.notified).toEqual([{ _tag: "UI/StateChanged", state: toUiState(lineup, dmax) }]);
  });

  it("…the autostart application of the channel the TV is on now, not the page that ran", async () => {
    const { ui, messaging, tabs, bootstrap } = await turnOn("dmax");
    // HGTV signals DMAX's application: it survives the change, on DMAX's page.
    await ui.request({ _tag: "UI/PlayChannel", channel: hgtv });

    await destroyApplication(messaging, TV_TAB);

    expect(tabs.navigations.slice(2)).toEqual([{ tabId: TV_TAB, url: "http://linear.example/hgtv.html" }]);
    expect(bootstrap.published[bootstrap.published.length - 1]).toBe(
      configBootstrapScript({
        config: toPageConfig(lineup, assetUrl),
        tunings: [{ url: "http://linear.example/hgtv.html", channelId: "hgtv" }],
      }),
    );
  });

  it("an application opened on its own exits too: its channel starts what it signals, or shows alone", async () => {
    const { messaging, tabs } = await setup(lineup, [
      { id: 1, url: "http://linear.example/dmax.html" },
      { id: 2, url: "http://app/b.xhtml" },
    ]);
    messaging.receive({ _tag: "Page/Ready", url: "http://linear.example/dmax.html" }, 1);
    await flushPromises();
    // No channel signals this page: the TV is on the first channel, DMAX.
    messaging.receive({ _tag: "Page/Ready", url: "http://app/b.xhtml" }, 2);
    await flushPromises();

    await destroyApplication(messaging, 1);
    await destroyApplication(messaging, 2);

    expect(tabs.navigations).toEqual([
      { tabId: 1, url: "http://linear.example/dmax.html" },
      { tabId: 2, url: "http://linear.example/dmax.html" },
    ]);
  });

  it("with no autostart application, the TV shows the channel alone", async () => {
    const { messaging, tabs } = await setup({
      ...lineup,
      runtime: { ...lineup.runtime, channels: [radio, dmax] },
    });
    messaging.receive({ _tag: "Page/Ready", url: "http://app/a.xhtml" }, 1);
    await flushPromises();

    await destroyApplication(messaging, 1);

    expect(tabs.navigations).toEqual([{ tabId: 1, url: "ext://hbb-emu/tv.html?channel=radio" }]);
  });

  it("a tab that is not a TV loads nothing", async () => {
    const { messaging, tabs } = await setup(lineup);

    await destroyApplication(messaging, 1);

    expect(tabs.navigations).toEqual([]);
  });
});

describe("BackgroundService — createApplication()", () => {
  const [first] = DEFAULT_STATE.runtime.channels;
  // DMAX: its linear application (AUTOSTART) and its full one (PRESENT, org 10 app 2).
  const dmax = {
    ...first!,
    id: "dmax",
    name: "DMAX",
    sid: 52,
    ait: {
      applications: [
        { orgId: 10, appId: 1, controlCode: "AUTOSTART" as const, url: "http://linear.example/dmax.html" },
        { orgId: 10, appId: 2, controlCode: "PRESENT" as const, url: "http://full.example/index.html?from=ait#top" },
      ],
    },
  };
  const news = {
    ...first!,
    id: "news",
    name: "NEWS",
    sid: 60,
    ait: { applications: [{ orgId: 20, appId: 1, controlCode: "AUTOSTART" as const, url: "http://news.example/" }] },
  };
  const lineup = { ...DEFAULT_STATE, runtime: { ...DEFAULT_STATE.runtime, channels: [dmax, news] } };
  const TV_TAB = 100;
  type Sent = { tabId: number; message: HostMessage };

  /** A TV turned on on DMAX, its application running; `pages` are what the TV can load. */
  const onDmax = async (pages: Record<string, string | null> = {}) => {
    const broadband: BroadbandAdapter = {
      fetchText: (url) =>
        url in pages
          ? TE.right({ contentType: pages[url] ?? null, body: "<html/>" })
          : TE.left({ _tag: "BroadbandFetchError", url, cause: new Error("HTTP 404") }),
    };
    const env = await setup(lineup, OPEN_TABS, true, undefined, broadband);
    await env.ui.request({ _tag: "UI/TurnOnTv", channelId: "dmax" });
    env.messaging.receive({ _tag: "Page/Ready", url: "http://linear.example/dmax.html" }, TV_TAB);
    await flushPromises();
    return env;
  };

  const createApplication = async (env: Awaited<ReturnType<typeof onDmax>>, url: string) => {
    env.messaging.receive({ _tag: "Page/CreateApplication", url }, TV_TAB);
    await flushPromises();
  };

  const loadErrors = (sent: ReadonlyArray<Sent>) =>
    sent.filter((s) => s.message._tag === "Host/ApplicationLoadError").map((s) => s.message);

  /** The last bootstrap published, as the script made of `tunings`. */
  const publishedWith = (bootstrap: { published: string[] }, tunings: BootstrapData["tunings"]) =>
    expect(bootstrap.published[bootstrap.published.length - 1]).toBe(
      configBootstrapScript({ config: toPageConfig(lineup, assetUrl), tunings }),
    );

  it("dvb://current.ait/<org>.<app> starts that application of the current AIT, with the URL's query and fragment (TS 102 796 §9.2)", async () => {
    const full = "http://full.example/index.html?from=ait&from=dvb#menu";
    const env = await onDmax({ [full]: "application/vnd.hbbtv.xhtml+xml" });

    await createApplication(env, "dvb://current.ait/a.2?from=dvb#menu");

    expect(env.tabs.navigations.slice(2)).toEqual([{ tabId: TV_TAB, url: full }]);
    // Broadcast-related: the TV still presents DMAX, and the new page starts on it.
    publishedWith(env.bootstrap, [{ url: full, channelId: "dmax" }]);
    expect(loadErrors(env.messaging.sent)).toEqual([]);
  });

  it("an HTTP(S) page is a broadcast-independent application: the TV selects no service (§6.2.2.6.1)", async () => {
    const page = "http://portal.example/";
    const env = await onDmax({ [page]: "text/html" });
    env.ui.notified.splice(0);

    await createApplication(env, page);
    env.messaging.receive({ _tag: "Page/Ready", url: page }, TV_TAB);
    await flushPromises();

    expect(env.tabs.navigations.slice(2)).toEqual([{ tabId: TV_TAB, url: page }]);
    publishedWith(env.bootstrap, [{ url: page, channelId: null }]);
    const sessions = env.messaging.sent.filter((s) => s.tabId === TV_TAB && s.message._tag === "Host/Session");
    expect(sessions[sessions.length - 1]?.message).toMatchObject({ session: { channel: null } });
    expect(env.ui.notified[env.ui.notified.length - 1]).toEqual({
      _tag: "UI/StateChanged",
      state: toUiState(lineup, null),
    });
  });

  it("…and selecting a channel stops it: the TV loads that channel's autostart application", async () => {
    const page = "http://portal.example/";
    const env = await onDmax({ [page]: "text/html" });
    await createApplication(env, page);

    env.messaging.receive({ _tag: "Page/SetChannel", channelId: "dmax" }, TV_TAB);
    await flushPromises();

    expect(env.tabs.navigations.slice(3)).toEqual([{ tabId: TV_TAB, url: "http://linear.example/dmax.html" }]);
    publishedWith(env.bootstrap, [{ url: "http://linear.example/dmax.html", channelId: "dmax" }]);
  });

  it("fails, without loading anything, for what the TV cannot start (§6.2.2.5.6, §9.2)", async () => {
    const env = await onDmax({ "http://portal.example/ait.xml": "application/vnd.dvb.ait+xml" });

    await createApplication(env, "dvb://current.ait/a.9");
    await createApplication(env, "dvb://233a.4.5.ait/a.2");
    await createApplication(env, "http://missing.example/");
    await createApplication(env, "http://portal.example/ait.xml");

    expect(env.tabs.navigations).toHaveLength(2);
    expect(loadErrors(env.messaging.sent)).toEqual([
      { _tag: "Host/ApplicationLoadError", url: "dvb://current.ait/a.9", reason: "DMAX signals no application a.9" },
      { _tag: "Host/ApplicationLoadError", url: "dvb://233a.4.5.ait/a.2", reason: "an application of another service" },
      { _tag: "Host/ApplicationLoadError", url: "http://missing.example/", reason: "HTTP 404" },
      {
        _tag: "Host/ApplicationLoadError",
        url: "http://portal.example/ait.xml",
        reason: "not an application page (application/vnd.dvb.ait+xml)",
      },
    ]);
  });

  it("a broadcast-independent application has no current AIT to start from", async () => {
    const page = "http://portal.example/";
    const env = await onDmax({ [page]: "text/html", "http://full.example/index.html?from=ait#top": null });
    await createApplication(env, page);

    await createApplication(env, "dvb://current.ait/a.2");

    expect(env.tabs.navigations).toHaveLength(3);
    expect(loadErrors(env.messaging.sent)).toEqual([
      { _tag: "Host/ApplicationLoadError", url: "dvb://current.ait/a.2", reason: "no service is selected" },
    ]);
  });
});
