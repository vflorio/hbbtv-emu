import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type FirefoxWithExtension, launchFirefoxWithExtension } from "./support/firefox";
import { type FixtureServer, startFixtureServer } from "./support/server";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION_DIR = join(root, "../extensions/firefox-v2/dist");
const BOOT_MARKER = "hbb-emu.page-runtime";

type BasicAppState = {
  initError: string | null;
  keysetValue: number | null;
  keys: number[];
  events: unknown[];
  userAgentAtFirstScript: string;
  configAtFirstScript: boolean;
  channelAtFirstScript: string | null;
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
let firefox: FirefoxWithExtension;

const appState = (page: Page) => page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e);

const openPage = async (path: string) => {
  const { page, errors } = await firefox.newPage();
  await page.goto(server.url(path));
  return { page, errors };
};

/**
 * The background page starts after the add-on is installed: wait until a page
 * finds the configuration at its first script (webRequest listeners and the
 * registered bootstrap are then in place).
 */
const waitForBackground = async () => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const { page } = await openPage(`basic-app/index.xhtml?warmup=${attempt}`);
    const state = await appState(page).catch(() => undefined);
    await page.close();
    if (state?.configAtFirstScript) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("the Firefox extension never became ready");
};

beforeAll(async () => {
  server = await startFixtureServer(join(root, "fixtures"));
  firefox = await launchFirefoxWithExtension(EXTENSION_DIR);
  await waitForBackground();
});

afterAll(async () => {
  await firefox?.close();
  await server?.close();
});

describe("firefox-v2: HbbTV application", () => {
  it("is served as HbbTV and rendered as XHTML by the browser", async () => {
    const { page } = await openPage("basic-app/index.xhtml");

    expect(await page.evaluate(() => document.contentType)).toBe("application/xhtml+xml");
  });

  it("has the OIPF APIs before the first application script runs", async () => {
    const { page, errors } = await openPage("basic-app/index.xhtml");

    const state = await appState(page);

    expect(errors).toEqual([]);
    expect(state.initError).toBeNull();
    expect(state.keysetValue).toBe(0x1f);
  });

  it("has the host's configuration at the first application script", async () => {
    const path = `basic-app/index.xhtml?ua=${Date.now()}`;
    const { page } = await openPage(path);

    const state = await appState(page);
    const request = server.requests.find((r) => r.url === `/${path}`);

    expect(state.configAtFirstScript).toBe(true);
    // The TV's user agent, the same over HTTP and in the page, from the start.
    expect(request?.userAgent).toContain("HbbTV/");
    expect(state.userAgentAtFirstScript).toBe(request?.userAgent);
  });

  it("delivers navigation keys to the application", async () => {
    const { page } = await openPage("basic-app/index.xhtml");

    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");

    expect((await appState(page)).keys).toEqual([38, 13]);
  });

  it("a remote OK key is indistinguishable from a real Enter", async () => {
    const { page, errors } = await openPage(`basic-app/index.xhtml?ok=${Date.now()}`);
    const events = async () => (await appState(page)).events;

    await page.keyboard.press("Enter");
    const real = await events();
    await page.evaluate(() => {
      (window as unknown as { __e2e: BasicAppState }).__e2e.events = [];
      // What the bridge does with a Host/DispatchKey from the background.
      const detail = JSON.stringify({ _tag: "Host/DispatchKey", keyCode: 13 });
      document.dispatchEvent(new CustomEvent("hbb-emu:to-page", { detail }));
    });

    expect(errors).toEqual([]);
    expect(await events()).toEqual(real);
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

  it("the page runtime talks to the background: it gets the configuration as a message too", async () => {
    const { page } = await firefox.newPage();
    await page.evaluateOnNewDocument(() => {
      const scope = window as unknown as { __e2eToPage: Array<{ _tag: string }> };
      scope.__e2eToPage = [];
      document.addEventListener("hbb-emu:to-page", (event) => {
        scope.__e2eToPage.push(JSON.parse((event as CustomEvent).detail));
      });
    });
    await page.goto(server.url("basic-app/index.xhtml?roundtrip"));

    await page.waitForFunction(() =>
      (window as unknown as { __e2eToPage: Array<{ _tag: string }> }).__e2eToPage.some((m) => m._tag === "Host/Config"),
    );
  });
});

describe("firefox-v2: ordinary web pages", () => {
  it("are left untouched", async () => {
    const { page, errors } = await openPage("plain-page/index.html");

    const booted = await page.evaluate((marker) => Symbol.for(marker) in window, BOOT_MARKER);

    expect(booted).toBe(false);
    expect(errors).toEqual([]);
  });
});

describe("firefox-v2: settings UI (sidebar)", () => {
  const openUi = async () => {
    const { page: ui, errors } = await firefox.openExtensionPage("index.html");
    // `browser.*` returns promises; Firefox's `chrome.*` takes callbacks.
    // As JSON: WebDriver BiDi sends an object seen twice in a value (e.g. the current
    // channel, also in the lineup) as a reference, which Puppeteer turns into undefined.
    const request = async (message: object): Promise<unknown> =>
      JSON.parse(
        await ui.evaluate(
          async (m) =>
            JSON.stringify(
              await (
                globalThis as unknown as { browser: { runtime: { sendMessage: (m: object) => Promise<unknown> } } }
              ).browser.runtime.sendMessage(m),
            ),
          message,
        ),
      );
    return { ui, errors, request };
  };

  it("loads the state from the background", async () => {
    const { ui, errors } = await openUi();

    await ui.locator("button ::-p-text(RED)").wait();

    expect(errors).toEqual([]);
  });

  it("its remote control drives the application in the active tab", async () => {
    const { ui } = await openUi();
    const { page: app } = await openPage(`basic-app/index.xhtml?ui=${Date.now()}`);
    await app.bringToFront(); // the sidebar sits next to the active tab

    await ui.locator("button ::-p-text(RED)").click();

    await app.waitForFunction(() => (window as unknown as { __e2e: BasicAppState }).__e2e.keys.length > 0);
    expect((await appState(app)).keys).toEqual([403]);
  });

  it("a user agent changed in the UI is what the next application sees at its first script", async () => {
    const { request } = await openUi();
    type UiState = { userAgent: string };
    const original = ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const userAgent = "Mozilla/5.0 (Linux; e2e) e2e-TV/3.0 HbbTV/1.5.1 (+DRM; e2e; TV; 3.0;)";

    try {
      await request({ _tag: "UI/SaveState", state: { ...original, userAgent } });
      const path = `basic-app/index.xhtml?ui-ua=${Date.now()}`;
      const { page } = await openPage(path);

      const state = await appState(page);
      expect(state.userAgentAtFirstScript).toBe(userAgent);
      expect(server.requests.find((r) => r.url === `/${path}`)?.userAgent).toBe(userAgent);
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
    }
  });

  it("each tab is a TV of its own: its channel survives a reload, other tabs keep theirs", async () => {
    const { request } = await openUi();
    type UiState = { channels: Channel[]; currentChannel: Channel | null };
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

  it("an application starts on the channel whose AIT signals it, already at its first script", async () => {
    const { request } = await openUi();
    type UiState = { channels: Channel[]; currentChannel: Channel | null };
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

      expect(errors).toEqual([]);
      expect((await appState(page)).channelAtFirstScript).toBe(signalling.id);
      await expect.poll(async () => (await getState()).currentChannel?.id, { timeout: 5000 }).toBe(signalling.id);
      expect(await page.evaluate(channelSeen)).toEqual({ application: signalling.id, videoBroadcast: signalling.id });
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
    }
  });

  it("after a reload, an application's first script sees the channel the UI tuned its tab to", async () => {
    const { request } = await openUi();
    type UiState = { channels: Channel[]; currentChannel: Channel | null };
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

      expect(errors).toEqual([]);
      expect((await appState(page)).channelAtFirstScript).toBe(second.id);
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
    }
  });

  it("a TV turned on from the UI loads its channel's application, and changes channel as a TV does", async () => {
    const { ui, request } = await openUi();
    type UiState = { channels: Channel[]; currentChannel: Channel | null };
    const original = ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const [first] = original.channels as [Channel];
    const appUrl = server.url(`basic-app/index.xhtml?linear=${Date.now()}`);
    // DMAX and HGTV signal the same application at the same URL: only the TV knows its channel.
    const linear = { applications: [{ orgId: 10, appId: 1, controlCode: "AUTOSTART", url: appUrl }] };
    const dmax = { ...first, id: "e2e-dmax", name: "e2e DMAX", sid: first.sid + 3000, ait: linear };
    const hgtv = { ...first, id: "e2e-hgtv", name: "e2e HGTV", sid: first.sid + 3001, ait: linear };
    const done = { _tag: "UI/Done" };

    try {
      await request({ _tag: "UI/SaveState", state: { ...original, channels: [first, dmax, hgtv] } });
      const opened = firefox.browser.waitForTarget((target) => target.url() === appUrl);
      expect(await request({ _tag: "UI/TurnOnTv", channelId: hgtv.id })).toEqual(done);
      const tv = (await (await opened).page())!;
      await tv.waitForFunction(() => "__e2e" in window && document.readyState === "complete");
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
      // Puppeteer does not follow a tab onto a privileged page: the extension tells where it is.
      const tabUrls = () =>
        ui.evaluate(async () => {
          const tabs = (
            globalThis as unknown as { browser: { tabs: { query: (q: object) => Promise<{ url?: string }[]> } } }
          ).browser.tabs;
          return (await tabs.query({})).map((tab) => tab.url);
        });
      await expect.poll(tabUrls, { timeout: 5000 }).toContain(firefox.extensionUrl(`tv.html?channel=${first.id}`));
      await tv.close();
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
    }
  });
});
