import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
});
