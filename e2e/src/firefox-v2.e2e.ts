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
});
