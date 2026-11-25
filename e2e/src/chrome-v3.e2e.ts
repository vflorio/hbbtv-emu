import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ExtensionBrowser, launchWithExtension } from "./support/browser";
import { type FixtureServer, startFixtureServer } from "./support/server";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION_DIR = join(root, "../extensions/chrome-v3/dist");
const BOOT_MARKER = "hbb-emu.page-runtime";

type BasicAppState = { initError: string | null; keysetValue: number | null; keys: number[] };

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
});
