import { configBootstrapScript, type HostMessage } from "@hbb-emu/protocol";
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
import { DEFAULT_STATE, type ExtensionState, toPageConfig, toUiState } from "../../state";
import { BackgroundService } from "./background";

/** Tab 1 is the active one (where the side panel is), tab 2 is in the background. */
const OPEN_TABS = [
  { id: 1, url: "http://app/a.xhtml" },
  { id: 2, url: "http://app/b.xhtml" },
];

const setup = async (stored?: ExtensionState, openTabs = OPEN_TABS, bootstrapAvailable = true) => {
  const messaging = createFakeMessaging<HostMessage>();
  const ui = createFakeUi();
  const userAgent = createFakeUserAgent();
  const bootstrap = createFakePageBootstrap(bootstrapAvailable);
  const background = new BackgroundService({
    config: { engine: "chrome", manifest: 3, storageKey: "test" },
    logger: silentLogger(),
    adapter: {
      storage: createFakeStorage<ExtensionState>(stored).storage,
      messaging: messaging.messaging,
      tabs: createFakeTabs(openTabs).tabs,
      webRequest: createFakeWebRequest().webRequest,
      ui: ui.ui,
      userAgent: userAgent.userAgent,
      pageBootstrap: bootstrap.pageBootstrap,
    },
  });
  expect(E.isRight(await background.init()())).toBe(true);
  return { background, messaging, ui, userAgent, bootstrap };
};

describe("BackgroundService", () => {
  it("sends the configuration to a page runtime that announces itself", async () => {
    const { messaging } = await setup();

    messaging.receive({ _tag: "Page/Ready", url: "http://app" }, 7);
    await flushPromises();

    expect(messaging.sent).toEqual([
      { tabId: 7, message: { _tag: "Host/Config", config: toPageConfig(DEFAULT_STATE) } },
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

  it("publishes the configuration for pages to find at document_start, before any page loads", async () => {
    const { bootstrap } = await setup(stored);

    expect(bootstrap.published).toEqual([configBootstrapScript(toPageConfig(stored))]);
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
    messaging.receive({ _tag: "Page/Ready", url: "http://app" }, 7);
    await flushPromises();

    expect(bootstrap.published).toEqual([configBootstrapScript(toPageConfig(stored))]);
  });

  it("once published, a page load does not publish again", async () => {
    const { messaging, bootstrap } = await setup();

    messaging.receive({ _tag: "Page/Ready", url: "http://app" }, 7);
    await flushPromises();

    expect(bootstrap.published).toHaveLength(1);
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

  it("playing a channel targets the active tab", async () => {
    const { ui, messaging } = await setup();
    const channel = uiState.channels[0]!;

    await ui.request({ _tag: "UI/PlayChannel", channel });

    expect(messaging.sent).toEqual([{ tabId: 1, message: { _tag: "Host/PlayChannel", channel } }]);
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
