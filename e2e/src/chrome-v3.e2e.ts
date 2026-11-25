import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAvControlScenario } from "./support/avControl";
import { type ExtensionBrowser, launchWithExtension } from "./support/browser";
import { type FixtureServer, startFixtureServer } from "./support/server";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION_DIR = join(root, "../extensions/chrome-v3/dist");
const BOOT_MARKER = "hbb-emu.page-runtime";

type BasicAppState = {
  initError: string | null;
  keysetValue: number | null;
  keys: number[];
  events: unknown[];
  userAgentAtFirstScript: string;
  channelAtFirstScript: string | null;
  factoryAtFirstScript: { videoBroadcast: boolean; drmAgent: boolean; channel: string | null };
};

type Channel = { id: string; sid: number };

/** The channel as the application reads it: its own (privateData) and its video/broadcast's. */
const channelSeen = () => {
  type WithChannel = { currentChannel: { ccid: string } | null };
  const appMgr = document.getElementById("appmgr") as unknown as {
    getOwnerApplication: (d: Document) => { privateData: WithChannel };
  };
  const video = document.getElementById("video") as unknown as WithChannel;
  return {
    application: appMgr.getOwnerApplication(document).privateData.currentChannel?.ccid ?? null,
    videoBroadcast: video.currentChannel?.ccid ?? null,
  };
};

let server: FixtureServer;
let browser: ExtensionBrowser;

beforeAll(async () => {
  server = await startFixtureServer(join(root, "fixtures"));
  browser = await launchWithExtension(EXTENSION_DIR);
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

const openPage = async (path: string) => {
  const page = await browser.context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.url(path));
  return { page, errors };
};

describe("chrome-v3: HbbTV application", () => {
  it("is served as HbbTV and rendered as XHTML by the browser", async () => {
    const { page } = await openPage("basic-app/index.xhtml");

    expect(await page.evaluate(() => document.contentType)).toBe("application/xhtml+xml");
  });

  it("has the OIPF APIs before the first application script runs", async () => {
    const { page, errors } = await openPage("basic-app/index.xhtml");

    const state = await page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e);

    expect(errors).toEqual([]);
    expect(state.initError).toBeNull();
    expect(state.keysetValue).toBe(0x1f);
    // oipfObjectFactory too, and what it creates works without being inserted.
    expect(state.factoryAtFirstScript).toEqual({
      videoBroadcast: true,
      drmAgent: false,
      channel: state.channelAtFirstScript,
    });
  });

  it("delivers navigation keys to the application", async () => {
    const { page } = await openPage("basic-app/index.xhtml");

    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");

    const keys = await page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e.keys);
    expect(keys).toEqual([38, 13]);
  });

  it("renders video/broadcast inside its object, sized by the application's CSS", async () => {
    const { page } = await openPage("basic-app/index.xhtml");

    const video = await page.evaluate(() => {
      const object = document.getElementById("video") as HTMLObjectElement & { width: unknown; height: unknown };
      const element = object.querySelector("video");
      const rect = element?.getBoundingClientRect();
      return {
        width: object.width,
        height: object.height,
        insideObject: element?.parentElement === object,
        rect: rect && { width: rect.width, height: rect.height },
      };
    });

    expect(video).toEqual({ width: 1280, height: 720, insideObject: true, rect: { width: 1280, height: 720 } });
  });

  it("plays VOD with an A/V Control object: play, seek, pause, stop, and to the end", async () => {
    const { page, errors } = await openPage("av-app/index.xhtml");

    try {
      await runAvControlScenario((fn) => page.evaluate(fn));
      expect(errors).toEqual([]);
    } finally {
      // A page that played media slows the next tab switches down (seen on Firefox).
      await page.close();
    }
  });
});

describe("chrome-v3: ordinary web pages", () => {
  it("are left untouched", async () => {
    const { page, errors } = await openPage("plain-page/index.html");

    const booted = await page.evaluate((marker) => Symbol.for(marker) in window, BOOT_MARKER);

    expect(booted).toBe(false);
    expect(errors).toEqual([]);
  });
});

describe("chrome-v3: page runtime ↔ background", () => {
  type Recorded = { message: { _tag: string; url?: string }; tabId?: number };

  /** Records, inside the service worker, what content scripts send to the background. */
  const recordBackgroundMessages = () =>
    browser.serviceWorker.evaluate(() => {
      const scope = globalThis as unknown as { __e2eReceived?: unknown[] };
      if (scope.__e2eReceived) return;
      scope.__e2eReceived = [];
      chrome.runtime.onMessage.addListener((message, sender) => {
        scope.__e2eReceived?.push({ message, tabId: sender.tab?.id });
      });
    });

  const waitForPageReady = async (url: string): Promise<number> => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const received = (await browser.serviceWorker.evaluate(
        () => (globalThis as unknown as { __e2eReceived: unknown[] }).__e2eReceived,
      )) as Recorded[];
      const ready = received.find((r) => r.message._tag === "Page/Ready" && r.message.url === url);
      if (ready?.tabId !== undefined) return ready.tabId;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`no Page/Ready from ${url}`);
  };

  /** Tabs of earlier tests are still open: a unique URL identifies this test's page. */
  const uniquePath = () => `basic-app/index.xhtml?run=${Math.random().toString(36).slice(2)}`;

  it("the page runtime announces itself to the background", async () => {
    await recordBackgroundMessages();
    const path = uniquePath();
    const url = server.url(path);

    await openPage(path);

    expect(await waitForPageReady(url)).toBeGreaterThan(0);
  });

  it("the background answers with the configuration, which reaches the page", async () => {
    const page = await browser.context.newPage();
    await page.addInitScript(() => {
      const scope = window as unknown as { __e2eToPage: unknown[] };
      scope.__e2eToPage = [];
      document.addEventListener("hbb-emu:to-page", (event) => {
        scope.__e2eToPage.push(JSON.parse((event as CustomEvent).detail));
      });
    });
    await page.goto(server.url("basic-app/index.xhtml"));

    await page.waitForFunction(() =>
      (window as unknown as { __e2eToPage: Array<{ _tag: string }> }).__e2eToPage.some((m) => m._tag === "Host/Config"),
    );
    const config = await page.evaluate(
      () =>
        (
          window as unknown as { __e2eToPage: Array<{ _tag: string; config?: { userAgent: string } }> }
        ).__e2eToPage.find((m) => m._tag === "Host/Config")?.config,
    );
    expect(config?.userAgent).toContain("HbbTV/");
  });

  it("a remote-control key sent by the background reaches the application", async () => {
    await recordBackgroundMessages();
    const path = uniquePath();
    const { page } = await openPage(path);
    const tabId = await waitForPageReady(server.url(path));

    await browser.serviceWorker.evaluate(
      (id) => chrome.tabs.sendMessage(id, { _tag: "Host/DispatchKey", keyCode: 403 }),
      tabId,
    );

    await page.waitForFunction(() => (window as unknown as { __e2e: BasicAppState }).__e2e.keys.length > 0);
    const keys = await page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e.keys);
    expect(keys).toEqual([403]);
  });

  it("a remote OK key is indistinguishable from a real Enter", async () => {
    await recordBackgroundMessages();
    const path = uniquePath();
    const { page, errors } = await openPage(path);
    const tabId = await waitForPageReady(server.url(path));
    const events = () => page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e.events);

    await page.keyboard.press("Enter");
    const real = await events();
    await page.evaluate(() => {
      (window as unknown as { __e2e: BasicAppState }).__e2e.events = [];
    });
    await browser.serviceWorker.evaluate(
      (id) => chrome.tabs.sendMessage(id, { _tag: "Host/DispatchKey", keyCode: 13 }),
      tabId,
    );
    await page.waitForFunction(() => (window as unknown as { __e2e: BasicAppState }).__e2e.events.length >= 3);

    expect(errors).toEqual([]);
    expect(await events()).toEqual(real);
  });
});

describe("chrome-v3: settings UI", () => {
  const openUi = async () => {
    const extensionId = new URL(browser.serviceWorker.url()).host;
    const ui = await browser.context.newPage();
    const errors: string[] = [];
    ui.on("pageerror", (error) => errors.push(error.message));
    await ui.goto(`chrome-extension://${extensionId}/index.html`);
    return { ui, errors };
  };

  it("loads the state from the background", async () => {
    const { ui, errors } = await openUi();

    await ui.getByRole("button", { name: "RED" }).waitFor();

    expect(errors).toEqual([]);
  });

  it("its remote control drives the application in the active tab", async () => {
    const { ui } = await openUi();
    const { page: app } = await openPage(`basic-app/index.xhtml?ui=${Date.now()}`);
    await app.bringToFront(); // the side panel sits next to the active tab

    await ui.getByRole("button", { name: "RED" }).click();

    await app.waitForFunction(() => (window as unknown as { __e2e: BasicAppState }).__e2e.keys.length > 0);
    const keys = await app.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e.keys);
    expect(keys).toEqual([403]);
  });

  it("the configured user agent is what the server receives and what the application reads", async () => {
    const { ui } = await openUi();
    type UiState = { userAgent: string };
    const request = (message: object) => ui.evaluate((m) => chrome.runtime.sendMessage(m), message);
    const original = ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const userAgent = "Mozilla/5.0 (Linux; e2e) e2e-TV/1.0 HbbTV/1.5.1 (+DRM; e2e; TV; 1.0;)";

    try {
      await request({ _tag: "UI/SaveState", state: { ...original, userAgent } });
      const path = `basic-app/index.xhtml?ua=${Date.now()}`;
      const { page } = await openPage(path);
      await page.evaluate(() => fetch("/basic-app/index.xhtml?xhr"));

      const seen = server.requests.filter((r) => r.url === `/${path}` || r.url === "/basic-app/index.xhtml?xhr");
      expect(seen.map((r) => r.userAgent)).toEqual([userAgent, userAgent]);
      // Without user scripts allowed, it arrives later: by the time the page has loaded.
      await page.waitForFunction((expected) => navigator.userAgent === expected, userAgent);
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
    }
  });

  it("each tab is a TV of its own: its channel survives a reload, other tabs keep theirs", async () => {
    const { ui } = await openUi();
    type UiState = { channels: Channel[]; currentChannel: Channel | null };
    const request = (message: object) => ui.evaluate((m) => chrome.runtime.sendMessage(m), message);
    const getState = async () => ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const original = await getState();
    const [first] = original.channels as [Channel];
    const second = { ...first, id: "e2e-second", name: "e2e second", sid: first.sid + 1000 };
    const on = (id: string) => ({ application: id, videoBroadcast: id });

    try {
      await request({ _tag: "UI/SaveState", state: { ...original, channels: [first, second] } });
      const { page: tv } = await openPage(`basic-app/index.xhtml?tv=${Date.now()}`);
      const { page: other } = await openPage(`basic-app/index.xhtml?other=${Date.now()}`);
      await tv.bringToFront(); // the UI acts on the active tab
      // Its TV session opens once the page has announced itself.
      await expect.poll(async () => (await getState()).currentChannel?.id, { timeout: 5000 }).toBe(first.id);

      expect(await request({ _tag: "UI/PlayChannel", channel: second })).toEqual({ _tag: "UI/Done" });
      await expect.poll(() => tv.evaluate(channelSeen), { timeout: 5000 }).toEqual(on(second.id));

      await tv.reload();
      await expect.poll(() => tv.evaluate(channelSeen), { timeout: 5000 }).toEqual(on(second.id));
      expect(await other.evaluate(channelSeen)).toEqual(on(first.id));

      // The UI follows the active tab without asking: switching tabs pushes that TV's channel.
      await ui.evaluate(() => {
        const shown: Array<string | null> = [];
        Object.assign(window, { __uiShown: shown });
        chrome.runtime.onMessage.addListener((message: { _tag?: string; state?: UiState }) => {
          if (message._tag === "UI/StateChanged") shown.push(message.state?.currentChannel?.id ?? null);
        });
      });
      const lastShown = () =>
        ui.evaluate(() => (window as unknown as { __uiShown: Array<string | null> }).__uiShown.at(-1));
      await other.bringToFront();
      await expect.poll(lastShown, { timeout: 5000 }).toBe(first.id);
      await tv.bringToFront();
      await expect.poll(lastShown, { timeout: 5000 }).toBe(second.id);
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
    }
  });

  // Last: it changes the browser for the tests after it.
  it("with user scripts allowed, the application's first script already sees the configuration", async () => {
    await browser.allowUserScripts();
    const { ui } = await openUi();
    type UiState = { userAgent: string };
    const request = (message: object) => ui.evaluate((m) => chrome.runtime.sendMessage(m), message);
    const original = ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const userAgent = "Mozilla/5.0 (Linux; e2e) e2e-TV/2.0 HbbTV/1.5.1 (+DRM; e2e; TV; 2.0;)";

    try {
      await request({ _tag: "UI/SaveState", state: { ...original, userAgent } });
      const { page, errors } = await openPage(`basic-app/index.xhtml?bootstrap=${Date.now()}`);

      const state = await page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e);
      expect(errors).toEqual([]);
      expect(state.initError).toBeNull();
      expect(state.userAgentAtFirstScript).toBe(userAgent);
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
    }
  });

  it("…and the channel whose AIT signals the application, which the tab's TV session then keeps", async () => {
    const { ui } = await openUi();
    type UiState = { channels: Channel[]; currentChannel: Channel | null };
    const request = (message: object) => ui.evaluate((m) => chrome.runtime.sendMessage(m), message);
    const getState = async () => ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const original = await getState();
    const [first] = original.channels as [Channel];
    const path = `basic-app/index.xhtml?ait=${Date.now()}`;
    const signalling = {
      ...first,
      id: "e2e-signalling",
      name: "e2e signalling",
      sid: first.sid + 2000,
      ait: { applications: [{ orgId: 1, appId: 1, controlCode: "AUTOSTART", url: server.url(path) }] },
    };

    try {
      await request({ _tag: "UI/SaveState", state: { ...original, channels: [first, signalling] } });
      const { page, errors } = await openPage(path);
      await page.bringToFront();

      const state = await page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e);
      expect(errors).toEqual([]);
      expect(state.channelAtFirstScript).toBe(signalling.id);
      await expect.poll(async () => (await getState()).currentChannel?.id, { timeout: 5000 }).toBe(signalling.id);
      expect(await page.evaluate(channelSeen)).toEqual({ application: signalling.id, videoBroadcast: signalling.id });
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
    }
  });

  it("…and, after a reload, the channel the UI tuned the tab to", async () => {
    const { ui } = await openUi();
    type UiState = { channels: Channel[]; currentChannel: Channel | null };
    const request = (message: object) => ui.evaluate((m) => chrome.runtime.sendMessage(m), message);
    const getState = async () => ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const original = await getState();
    const [first] = original.channels as [Channel];
    const second = { ...first, id: "e2e-second", name: "e2e second", sid: first.sid + 1000 };

    try {
      await request({ _tag: "UI/SaveState", state: { ...original, channels: [first, second] } });
      const { page, errors } = await openPage(`basic-app/index.xhtml?retuned=${Date.now()}`);
      await page.bringToFront();
      await expect.poll(async () => (await getState()).currentChannel?.id, { timeout: 5000 }).toBe(first.id);
      expect(await request({ _tag: "UI/PlayChannel", channel: second })).toEqual({ _tag: "UI/Done" });

      await page.reload();

      const state = await page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e);
      expect(errors).toEqual([]);
      expect(state.channelAtFirstScript).toBe(second.id);
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
    }
  });

  it("a TV turned on from the UI loads its channel's application, and changes channel as a TV does", async () => {
    const { ui } = await openUi();
    const extensionId = new URL(browser.serviceWorker.url()).host;
    type UiState = { channels: Channel[]; currentChannel: Channel | null };
    const request = (message: object) => ui.evaluate((m) => chrome.runtime.sendMessage(m), message);
    const getState = async () => ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const original = await getState();
    const [first] = original.channels as [Channel];
    const appUrl = server.url(`basic-app/index.xhtml?linear=${Date.now()}`);
    // DMAX and HGTV signal the same application at the same URL: only the TV knows its channel.
    const linear = { applications: [{ orgId: 10, appId: 1, controlCode: "AUTOSTART", url: appUrl }] };
    const dmax = { ...first, id: "e2e-dmax", name: "e2e DMAX", sid: first.sid + 3000, ait: linear };
    const hgtv = { ...first, id: "e2e-hgtv", name: "e2e HGTV", sid: first.sid + 3001, ait: linear };
    const done = { _tag: "UI/Done" };
    const appState = (page: Page) => page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e);
    const loaded = async (page: Page, url: string) => {
      await page.waitForURL(url);
      await page.waitForFunction(() => "__e2e" in window);
    };

    try {
      await request({ _tag: "UI/SaveState", state: { ...original, channels: [first, dmax, hgtv] } });
      const opened = browser.context.waitForEvent("page");
      expect(await request({ _tag: "UI/TurnOnTv", channelId: hgtv.id })).toEqual(done);
      const tv = await opened;
      await loaded(tv, appUrl);
      expect((await appState(tv)).channelAtFirstScript).toBe(hgtv.id);

      // DMAX signals the running application: it keeps running, on the new channel.
      await tv.evaluate(() => Object.assign(window, { __stayed: true }));
      expect(await request({ _tag: "UI/PlayChannel", channel: dmax })).toEqual(done);
      await expect
        .poll(() => tv.evaluate(channelSeen), { timeout: 5000 })
        .toEqual({
          application: dmax.id,
          videoBroadcast: dmax.id,
        });
      expect(await tv.evaluate(() => "__stayed" in window)).toBe(true);

      // The first channel signals no application: the TV shows the channel alone.
      expect(await request({ _tag: "UI/PlayChannel", channel: first })).toEqual(done);
      await tv.waitForURL(`chrome-extension://${extensionId}/tv.html?channel=${first.id}`);
      await expect.poll(() => tv.evaluate(() => document.body.dataset.channel)).toBe(first.id);

      // Back to HGTV: its application again, on HGTV from its first script.
      expect(await request({ _tag: "UI/PlayChannel", channel: hgtv })).toEqual(done);
      await loaded(tv, appUrl);
      expect((await appState(tv)).channelAtFirstScript).toBe(hgtv.id);
      await tv.close();
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
    }
  });

  it("the application's setChannel() changes the TV's channel as the UI does; on its own, it gets an error", async () => {
    const { ui } = await openUi();
    type Service = Channel & { onid: number; tsid: number };
    type UiState = { channels: Service[]; currentChannel: Service | null };
    const request = (message: object) => ui.evaluate((m) => chrome.runtime.sendMessage(m), message);
    const getState = async () => ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const original = await getState();
    const [first] = original.channels as [Service];
    const stamp = Date.now();
    const appUrl = server.url(`basic-app/index.xhtml?linear=${stamp}`);
    const newsUrl = server.url(`basic-app/index.xhtml?news=${stamp}`);
    const signals = (orgId: number, url: string) => ({
      applications: [{ orgId, appId: 1, controlCode: "AUTOSTART", url }],
    });
    const dmax = { ...first, id: "e2e-dmax", name: "e2e DMAX", sid: first.sid + 3000, ait: signals(10, appUrl) };
    const hgtv = { ...first, id: "e2e-hgtv", name: "e2e HGTV", sid: first.sid + 3001, ait: signals(10, appUrl) };
    const news = { ...first, id: "e2e-news", name: "e2e NEWS", sid: first.sid + 3002, ait: signals(20, newsUrl) };
    const appState = (page: Page) => page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e);
    const loaded = async (page: Page, url: string) => {
      await page.waitForURL(url);
      await page.waitForFunction(() => "__e2e" in window);
    };
    /** What an application does: the channel from its triplet, then setChannel(); errors are recorded. */
    const setChannel = (page: Page, to: Service) =>
      page.evaluate(({ onid, tsid, sid }) => {
        type Vb = {
          createChannelObject: (idType: number, onid: number, tsid: number, sid: number) => unknown;
          setChannel: (channel: unknown) => void;
          onChannelChangeError: (channel: unknown, error: number) => void;
        };
        const video = document.getElementById("video") as unknown as Vb;
        const errors: number[] = [];
        Object.assign(window, { __channelErrors: errors });
        video.onChannelChangeError = (_, error) => errors.push(error);
        video.setChannel(video.createChannelObject(12 /* ID_DVB_T */, onid, tsid, sid));
      }, to);
    const channelErrors = (page: Page) =>
      page.evaluate(() => (window as unknown as { __channelErrors: number[] }).__channelErrors);

    try {
      await request({ _tag: "UI/SaveState", state: { ...original, channels: [first, dmax, hgtv, news] } });
      const opened = browser.context.waitForEvent("page");
      expect(await request({ _tag: "UI/TurnOnTv", channelId: dmax.id })).toEqual({ _tag: "UI/Done" });
      const tv = await opened;
      await loaded(tv, appUrl);

      // HGTV signals the running application: it keeps running, on HGTV, and the UI shows it.
      await tv.evaluate(() => Object.assign(window, { __stayed: true }));
      await setChannel(tv, hgtv);
      await expect
        .poll(() => tv.evaluate(channelSeen), { timeout: 5000 })
        .toEqual({
          application: hgtv.id,
          videoBroadcast: hgtv.id,
        });
      expect(await tv.evaluate(() => "__stayed" in window)).toBe(true);
      expect(await channelErrors(tv)).toEqual([]);
      expect((await getState()).currentChannel?.id).toBe(hgtv.id);

      // NEWS signals another one: the TV loads it, on NEWS from its first script.
      await setChannel(tv, news);
      await loaded(tv, newsUrl);
      expect((await appState(tv)).channelAtFirstScript).toBe(news.id);
      await tv.close();

      // An application opened on its own (app mode) has only its channel: DMAX, the
      // first whose AIT signals an application of its origin.
      const { page: alone } = await openPage(`basic-app/index.xhtml?alone=${stamp}`);
      const onDmax = { application: dmax.id, videoBroadcast: dmax.id };
      await expect.poll(() => alone.evaluate(channelSeen), { timeout: 5000 }).toEqual(onDmax);
      await setChannel(alone, hgtv);
      await expect.poll(() => channelErrors(alone), { timeout: 5000 }).toEqual([5]);
      expect(await alone.evaluate(channelSeen)).toEqual(onDmax);
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
    }
  });

  it("getChannelConfig() lists the lineup, and nextChannel()/prevChannel() go through it as setChannel() does", async () => {
    const { ui } = await openUi();
    type Service = Channel & { onid: number; tsid: number };
    type UiState = { channels: Service[]; currentChannel: Service | null };
    const request = (message: object) => ui.evaluate((m) => chrome.runtime.sendMessage(m), message);
    const getState = async () => ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const original = await getState();
    const [first] = original.channels as [Service];
    const stamp = Date.now();
    const appUrl = server.url(`basic-app/index.xhtml?zap=${stamp}`);
    const newsUrl = server.url(`basic-app/index.xhtml?zap-news=${stamp}`);
    const signals = (orgId: number, url: string) => ({
      applications: [{ orgId, appId: 1, controlCode: "AUTOSTART", url }],
    });
    const dmax = { ...first, id: "e2e-dmax", name: "e2e DMAX", sid: first.sid + 3000, ait: signals(10, appUrl) };
    const hgtv = { ...first, id: "e2e-hgtv", name: "e2e HGTV", sid: first.sid + 3001, ait: signals(10, appUrl) };
    const news = { ...first, id: "e2e-news", name: "e2e NEWS", sid: first.sid + 3002, ait: signals(20, newsUrl) };
    /** The lineup as the application reads it from getChannelConfig(). */
    const channelList = (page: Page) =>
      page.evaluate(() => {
        type List = { length: number; item: (index: number) => { ccid: string } };
        const video = document.getElementById("video") as unknown as {
          getChannelConfig: () => { channelList: List };
        };
        const list = video.getChannelConfig().channelList;
        return Array.from({ length: list.length }, (_, index) => list.item(index).ccid);
      });
    const zap = (page: Page, method: "nextChannel" | "prevChannel") =>
      page.evaluate((m) => {
        const video = document.getElementById("video") as unknown as Record<string, () => void>;
        video[m]!();
      }, method);
    const appState = (page: Page) => page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e);
    const loaded = async (page: Page, url: string) => {
      await page.waitForURL(url);
      await page.waitForFunction(() => "__e2e" in window);
    };

    try {
      await request({ _tag: "UI/SaveState", state: { ...original, channels: [first, dmax, hgtv, news] } });
      const opened = browser.context.waitForEvent("page");
      expect(await request({ _tag: "UI/TurnOnTv", channelId: dmax.id })).toEqual({ _tag: "UI/Done" });
      const tv = await opened;
      await loaded(tv, appUrl);
      expect(await channelList(tv)).toEqual([first.id, dmax.id, hgtv.id, news.id]);

      // DMAX → HGTV → DMAX: both signal the running application, which keeps running.
      await tv.evaluate(() => Object.assign(window, { __stayed: true }));
      await zap(tv, "nextChannel");
      await expect
        .poll(() => tv.evaluate(channelSeen), { timeout: 5000 })
        .toEqual({
          application: hgtv.id,
          videoBroadcast: hgtv.id,
        });
      await zap(tv, "prevChannel");
      await expect
        .poll(() => tv.evaluate(channelSeen), { timeout: 5000 })
        .toEqual({
          application: dmax.id,
          videoBroadcast: dmax.id,
        });
      expect(await tv.evaluate(() => "__stayed" in window)).toBe(true);
      expect((await getState()).currentChannel?.id).toBe(dmax.id);

      // Two up, NEWS: it signals another application, which the TV loads, on NEWS from its first script.
      await zap(tv, "nextChannel");
      await expect.poll(() => tv.evaluate(channelSeen), { timeout: 5000 }).toMatchObject({ application: hgtv.id });
      await zap(tv, "nextChannel");
      await loaded(tv, newsUrl);
      expect((await appState(tv)).channelAtFirstScript).toBe(news.id);
      await tv.close();
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
    }
  });
});
