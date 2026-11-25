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
