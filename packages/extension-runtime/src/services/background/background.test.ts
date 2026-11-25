import { type BootstrapData, configBootstrapScript, type HostMessage } from "@hbb-emu/protocol";
import * as E from "fp-ts/Either";
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
    },
  });
  expect(E.isRight(await background.init()())).toBe(true);
  return { background, messaging, ui, userAgent, bootstrap, tabs, sessionStorage };
};

describe("BackgroundService", () => {
  it("sends the configuration, then the tab's TV session, to a page runtime that announces itself", async () => {
    const { messaging } = await setup();

    messaging.receive({ _tag: "Page/Ready", url: "http://app" }, 7);
    await flushPromises();

    expect(messaging.sent).toEqual([
      { tabId: 7, message: { _tag: "Host/Config", config: toPageConfig(DEFAULT_STATE) } },
      { tabId: 7, message: { _tag: "Host/Session", session: { channel: DEFAULT_STATE.runtime.channels[0] } } },
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
    configBootstrapScript({ config: toPageConfig(state), tunings });

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
    const config = toPageConfig(DEFAULT_STATE);

    expect(config.userAgent).toContain("HbbTV/");
    expect(config.channels.length).toBeGreaterThan(0);
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
    expect(ui.notified).toEqual([{ _tag: "UI/StateChanged", state: toUiState(lineup, hgtv) }]);
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
    const stored: TvSessions = {
      "1": { mode: "app", channelId: "hgtv", url: null },
      "99": { mode: "app", channelId: "hgtv", url: null },
    };
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
    const stored: TvSessions = { "1": { mode: "app", channelId: "gone", url: null } };
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
