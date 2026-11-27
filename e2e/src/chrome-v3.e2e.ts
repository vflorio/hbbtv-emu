import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  runAudioScenario,
  runAvControlScenario,
  runQueueScenario,
  runUnreachableStreamScenario,
} from "./support/avControl";
import { localStreamChannel, runBroadcastLayerScenario, runShippedTestCardScenario } from "./support/broadcastLayer";
import { type ExtensionBrowser, launchWithExtension } from "./support/browser";
import { runHtml5DashScenario } from "./support/html5Dash";
import { type FixtureServer, startFixtureServer } from "./support/server";
import { runStreamEventScenario, streamEventChannel } from "./support/streamEvents";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION_DIR = join(root, "../extensions/chrome-v3/dist");
const BOOT_MARKER = "hbb-emu.page-runtime";

type BasicAppState = {
  initError: string | null;
  keysetValue: number | null;
  keys: number[];
  events: unknown[];
  userAgentAtFirstScript: string;
  userAgentDataAtFirstScript: boolean;
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

/**
 * Records the real key events, as the browser makes them, and keeps them from the
 * emulator (which would turn them into the remote's, and cancel them): on the window,
 * in the capture phase, installed before any of the page's scripts.
 */
const recordRealKeys = () => {
  const real: unknown[] = [];
  Object.assign(window, { __e2eReal: real });
  for (const type of ["keydown", "keypress", "keyup"]) {
    window.addEventListener(
      type,
      (event) => {
        const key = event as KeyboardEvent;
        if (!key.isTrusted) return;
        key.stopImmediatePropagation();
        const target = key.target as Element;
        real.push({
          type: key.type,
          target: target.tagName.toLowerCase() + (target.getAttribute("id") || ""),
          key: key.key,
          keyCode: key.keyCode,
          which: key.which,
          charCode: key.charCode,
        });
      },
      true,
    );
  }
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

  it("video/broadcast's intrinsic events are DOM events of the object too (OIPF DAE §7.13.1.4)", async () => {
    const { page, errors } = await openPage(`basic-app/index.xhtml?events=${Date.now()}`);

    const seen = await page.evaluate(() => {
      type VideoBroadcastObject = HTMLObjectElement & {
        onPlayStateChange: ((state: number, error?: number) => void) | null;
        release: () => void;
      };
      const object = document.getElementById("video") as VideoBroadcastObject;
      const seen: unknown[] = [];
      object.onPlayStateChange = (state) => seen.push({ property: state });
      object.addEventListener("PlayStateChange", (event) => {
        const { state, error } = event as Event & { state: number; error?: number };
        seen.push({ type: event.type, bubbles: event.bubbles, state, error: "error" in event ? error : "missing" });
      });
      document.addEventListener("PlayStateChange", () => seen.push("bubbled"));
      object.release();
      return seen;
    });

    expect(seen).toEqual([{ property: 0 }, { type: "PlayStateChange", bubbles: false, state: 0, error: undefined }]);
    expect(errors).toEqual([]);
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

  it("tells the application when a DASH or HLS stream cannot be reached", async () => {
    type Player = HTMLObjectElement & { data: string; play: (speed: number) => boolean };
    for (const start of [
      () => {
        const player = document.getElementById("player") as Player;
        player.data = "missing.mpd";
        return player.play(1);
      },
      () => {
        const player = document.getElementById("player") as Player;
        player.data = "missing.m3u8";
        return player.play(1);
      },
    ]) {
      const { page, errors } = await openPage(`av-app/index.xhtml?unreachable=${Date.now()}`);
      try {
        await page.evaluate(() => {
          // Only what happens from now on.
          (window as unknown as { __e2e: { playStates: number[] } }).__e2e.playStates = [];
        });
        await runUnreachableStreamScenario((fn) => page.evaluate(fn), start);
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    }
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

  it("plays audio with A/V Control objects of type audio/mpeg and audio/mp4 (TS 102 796 Table 9)", async () => {
    const { page, errors } = await openPage(`audio-app/index.xhtml?audio=${Date.now()}`);

    try {
      await runAudioScenario((fn) => page.evaluate(fn));
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it("plays an MPD set as the source of the application's own <video> (TS 102 796 §9.4.2)", async () => {
    const { page, errors } = await openPage(`dash-app/index.xhtml?dash=${Date.now()}`);

    try {
      await runHtml5DashScenario(
        (fn) => page.evaluate(fn),
        server.url("dash-app/clip.mpd"),
        () => server.requests.map((request) => request.url),
      );
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it("plays the item queue() holds after the current one (TS 102 796 A.2.5.1)", async () => {
    const { page, errors } = await openPage(`audio-app/index.xhtml?queue=${Date.now()}`);

    try {
      await runQueueScenario((fn) => page.evaluate(fn));
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
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
    const page = await browser.context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(recordRealKeys);
    await page.goto(server.url(path));
    const tabId = await waitForPageReady(server.url(path));
    const events = () => page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e.events);

    await page.keyboard.press("Enter");
    const real = await page.evaluate(() => (window as unknown as { __e2eReal: unknown[] }).__e2eReal);
    expect(real).toHaveLength(3);

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

  it("the application receives only the keys of its keyset, never those the TV keeps", async () => {
    const { ui } = await openUi();
    const { page: app } = await openPage(`basic-app/index.xhtml?keyset=${Date.now()}`);
    await app.bringToFront();

    // The application asked for colours and navigation: not the digits; CH+ is the TV's.
    for (const name of ["1", "CH+", "RED", "UP"]) {
      await ui.getByRole("button", { name, exact: true }).click();
    }

    await app.waitForFunction(() => (window as unknown as { __e2e: BasicAppState }).__e2e.keys.length >= 2);
    const keys = await app.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e.keys);
    expect(keys).toEqual([403, 38]);
  });

  it("VOL-/VOL+ set the TV's volume, which video/broadcast's own volume only attenuates", async () => {
    const { ui } = await openUi();
    const { page: app } = await openPage(`basic-app/index.xhtml?volume=${Date.now()}`);
    await app.bringToFront();
    const audio = () =>
      app.evaluate(() => {
        const object = document.getElementById("video") as unknown as { getVolume: () => number };
        // The broadcast's video: in the object while it is bound, behind the application once released.
        const element = (document.querySelector("#video video") ??
          document.querySelector("[data-hbbtv-emu-broadcast]")?.shadowRoot?.querySelector("video")) as HTMLVideoElement;
        return { object: object.getVolume(), element: Math.round(element.volume * 100) / 100 };
      });

    for (const name of ["VOL-", "VOL-"]) {
      await ui.getByRole("button", { name, exact: true }).click();
    }
    await expect.poll(audio, { timeout: 5000 }).toEqual({ object: 100, element: 0.9 });

    // TS 102 796 §10.2.12: 86 is 14 dB less, a factor of 0.2, in series with the TV.
    await app.evaluate(() =>
      (document.getElementById("video") as unknown as { setVolume: (v: number) => boolean }).setVolume(86),
    );
    expect(await audio()).toEqual({ object: 86, element: 0.18 });

    // §10.2.12: once released, the object's volume ceases to have effect; bound again, only the TV's is left.
    type Bindable = { playState: number; release: () => void; bindToCurrentChannel: () => unknown };
    const unrealized = await app.evaluate(() => {
      const object = document.getElementById("video") as unknown as Bindable;
      object.release();
      return object.playState;
    });
    expect(unrealized).toBe(0);
    expect(await audio()).toEqual({ object: 100, element: 0.9 });
    const playState = () => app.evaluate(() => (document.getElementById("video") as unknown as Bindable).playState);
    await app.evaluate(() => {
      (document.getElementById("video") as unknown as Bindable).bindToCurrentChannel();
    });
    await expect.poll(playState, { timeout: 5000 }).not.toBe(0);
    expect(await audio()).toEqual({ object: 100, element: 0.9 });

    // The volume is the TV's: the tab's next page has it too.
    await app.reload();
    await expect.poll(audio, { timeout: 5000 }).toEqual({ object: 100, element: 0.9 });
  });

  it("the application's own <video> plays in series with the TV's volume, which it does not see", async () => {
    const { ui } = await openUi();
    const { page: app } = await openPage(`basic-app/index.xhtml?media=${Date.now()}`);
    await app.bringToFront();
    const media = () =>
      app.evaluate(() => {
        const video = document.getElementById("e2e-media") as HTMLVideoElement;
        // An empty iframe gets no runtime: its accessor is the browser's, which reads what the element plays at.
        let frame = document.getElementById("e2e-pristine") as HTMLIFrameElement | null;
        if (frame === null) {
          frame = document.createElement("iframe");
          frame.id = "e2e-pristine";
          document.body.appendChild(frame);
        }
        const pristine = frame.contentWindow as Window & typeof globalThis;
        const volume = Object.getOwnPropertyDescriptor(pristine.HTMLMediaElement.prototype, "volume")?.get;
        return {
          application: video.volume,
          playing: !video.paused,
          element: Math.round((volume?.call(video) as number) * 100) / 100,
        };
      });

    // TS 102 796 §10.2.12: the application's own <video> too, in series with the TV, linear in amplitude.
    await app.evaluate(async (src) => {
      const video = document.createElement("video");
      video.id = "e2e-media";
      video.muted = true;
      video.loop = true;
      video.src = src;
      document.body.appendChild(video);
      await video.play();
      video.volume = 0.5;
    }, server.url("av-app/clip.mp4"));
    expect(await media()).toEqual({ application: 0.5, playing: true, element: 0.5 });

    for (const name of ["VOL-", "VOL-"]) {
      await ui.getByRole("button", { name, exact: true }).click();
    }
    await expect.poll(media, { timeout: 5000 }).toEqual({ application: 0.5, playing: true, element: 0.45 });
  });

  it("the keyboard is the remote: the keyset's keys go to the application, P+ and VOL- to the TV, text fields type", async () => {
    const { ui } = await openUi();
    type UiState = { channels: Channel[]; currentChannel: Channel | null };
    const request = (message: object) => ui.evaluate((m) => chrome.runtime.sendMessage(m), message);
    const getState = async () => ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const original = await getState();
    const [first] = original.channels as [Channel];
    const second = { ...first, id: "e2e-second", name: "e2e second", sid: first.sid + 1000 };
    const keys = () => app.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e.keys);
    const volume = () =>
      app.evaluate(() => Math.round((document.querySelector("#video video") as HTMLVideoElement).volume * 100) / 100);

    await request({ _tag: "UI/SaveState", state: { ...original, channels: [first, second] } });
    const { page: app, errors } = await openPage(`basic-app/index.xhtml?keyboard=${Date.now()}`);
    try {
      await app.bringToFront();
      await expect.poll(async () => (await getState()).currentChannel?.id, { timeout: 5000 }).toBe(first.id);

      // Colours and navigation are in the keyset; the digits are not, and "a" is no remote key.
      for (const key of ["1", "a", "r", "ArrowUp"]) await app.keyboard.press(key);
      expect(await keys()).toEqual([403, 38]);

      await app.keyboard.press("PageUp");
      await expect
        .poll(() => app.evaluate(channelSeen), { timeout: 5000 })
        .toEqual({ application: second.id, videoBroadcast: second.id });
      await app.keyboard.press("-");
      await expect.poll(volume, { timeout: 5000 }).toBe(0.95);
      expect(await keys()).toEqual([403, 38]);

      // TS 102 796 §10.2.2.1: a focused text field gets the keys whatever the keyset.
      await app.evaluate(() => {
        const input = document.createElement("input");
        input.id = "text";
        document.body.appendChild(input);
        input.focus();
      });
      await app.keyboard.type("r1");
      expect(await app.evaluate(() => (document.getElementById("text") as HTMLInputElement).value)).toBe("r1");
      expect(await keys()).toEqual([403, 38, 82, 49]);
      expect(errors).toEqual([]);
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
      await app.close();
    }
  });

  it("the configured user agent is what the server receives and what the application reads, without the browser's client hints", async () => {
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
      // Chromium sends Sec-CH-UA* to a secure origin (127.0.0.1 is one): they would name it.
      expect(seen.map((r) => r.clientHints)).toEqual([[], []]);
      // Without user scripts allowed, it arrives later: by the time the page has loaded.
      await page.waitForFunction((expected) => navigator.userAgent === expected, userAgent);
      // The page runtime takes navigator.userAgentData away before the application's first script.
      const state = await page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e);
      expect(state.userAgentDataAtFirstScript).toBe(false);
      expect(await page.evaluate(() => [window.isSecureContext, "userAgentData" in navigator])).toEqual([true, false]);
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

      // The remote's P-/P+ zap through the lineup as the TV does: to DMAX, whose AIT
      // keeps the application running…
      await tv.evaluate(() => Object.assign(window, { __stayed: true }));
      expect(await request({ _tag: "UI/DispatchKey", keyCode: 428 })).toEqual(done);
      await expect
        .poll(() => tv.evaluate(channelSeen), { timeout: 5000 })
        .toEqual({ application: dmax.id, videoBroadcast: dmax.id });
      expect(await tv.evaluate(() => "__stayed" in window)).toBe(true);
      // …to the first channel, on the TV page, and from there back to DMAX's application.
      expect(await request({ _tag: "UI/DispatchKey", keyCode: 428 })).toEqual(done);
      await tv.waitForURL(`chrome-extension://${extensionId}/tv.html?channel=${first.id}`);
      expect(await request({ _tag: "UI/DispatchKey", keyCode: 427 })).toEqual(done);
      await loaded(tv, appUrl);
      expect((await appState(tv)).channelAtFirstScript).toBe(dmax.id);
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

  it("an application that exits (destroyApplication()) is stopped, and the TV starts its channel's autostart application again (TS 102 796 §6.2.2.3)", async () => {
    const { ui } = await openUi();
    type Service = Channel & { onid: number; tsid: number };
    type UiState = { channels: Service[]; currentChannel: Service | null };
    const request = (message: object) => ui.evaluate((m) => chrome.runtime.sendMessage(m), message);
    const getState = async () => ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const original = await getState();
    const [first] = original.channels as [Service];
    const stamp = Date.now();
    const dmaxUrl = server.url(`basic-app/index.xhtml?exit-dmax=${stamp}`);
    const hgtvUrl = server.url(`basic-app/index.xhtml?exit-hgtv=${stamp}`);
    // The same application (org 10, app 1), from a different URL on each channel.
    const signals = (url: string) => ({ applications: [{ orgId: 10, appId: 1, controlCode: "AUTOSTART", url }] });
    const dmax = { ...first, id: "e2e-dmax", name: "e2e DMAX", sid: first.sid + 3000, ait: signals(dmaxUrl) };
    const hgtv = { ...first, id: "e2e-hgtv", name: "e2e HGTV", sid: first.sid + 3001, ait: signals(hgtvUrl) };
    const appState = (page: Page) => page.evaluate(() => (window as unknown as { __e2e: BasicAppState }).__e2e);
    /** The application exits, twice as some do; the page records how it was hidden. */
    const exit = (page: Page) =>
      page.evaluate(() => {
        Object.assign(window, { __stayed: true });
        document.addEventListener("visibilitychange", () => {
          localStorage.setItem("e2e-exit-visibility", document.visibilityState);
        });
        type AppMgr = { getOwnerApplication: (d: Document) => { destroyApplication: () => void } };
        const app = (document.getElementById("appmgr") as unknown as AppMgr).getOwnerApplication(document);
        app.destroyApplication();
        app.destroyApplication();
      });
    /** The page that exited is gone, and `url` started in its place. */
    const restarted = async (page: Page, url: string) => {
      await expect
        .poll(() => page.evaluate(() => "__stayed" in window).catch(() => true), { timeout: 5000 })
        .toBe(false);
      await page.waitForURL(url);
      await page.waitForFunction(() => "__e2e" in window);
    };
    const exitVisibility = (page: Page) =>
      page.evaluate(() => {
        const seen = localStorage.getItem("e2e-exit-visibility");
        localStorage.removeItem("e2e-exit-visibility");
        return seen;
      });

    try {
      await request({ _tag: "UI/SaveState", state: { ...original, channels: [first, dmax, hgtv] } });
      const opened = browser.context.waitForEvent("page");
      expect(await request({ _tag: "UI/TurnOnTv", channelId: dmax.id })).toEqual({ _tag: "UI/Done" });
      const tv = await opened;
      await tv.waitForURL(dmaxUrl);
      await tv.waitForFunction(() => "__e2e" in window);

      // DMAX's AIT signals it as autostart: the TV starts it again, the same page.
      await exit(tv);
      await restarted(tv, dmaxUrl);
      expect((await appState(tv)).channelAtFirstScript).toBe(dmax.id);
      // The TV stopped the page as it stops an application (§6.2.2.11).
      expect(await exitVisibility(tv)).toBe("hidden");

      // On HGTV, which signals it too, the application keeps running on DMAX's page.
      // When it exits, the TV starts HGTV's autostart application: HGTV's page.
      expect(await request({ _tag: "UI/PlayChannel", channel: hgtv })).toEqual({ _tag: "UI/Done" });
      await expect.poll(() => tv.evaluate(channelSeen), { timeout: 5000 }).toMatchObject({ application: hgtv.id });
      await exit(tv);
      await restarted(tv, hgtvUrl);
      expect((await appState(tv)).channelAtFirstScript).toBe(hgtv.id);
      expect((await getState()).currentChannel?.id).toBe(hgtv.id);
      await tv.close();
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

  it("stream events described by XML over HTTP, from another origin without CORS (TS 102 796 §8.2.1)", async () => {
    const { ui } = await openUi();
    type UiState = { channels: Channel[] };
    const request = (message: object) => ui.evaluate((m) => chrome.runtime.sendMessage(m), message);
    const getState = async () => ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const original = await getState();
    const [first] = original.channels as [Channel];
    // Another origin (another port), whose server sends no CORS headers.
    const broadcaster = await startFixtureServer(join(root, "fixtures"));
    const described = broadcaster.url("stream-events/default.ste");

    try {
      await request({
        _tag: "UI/SaveState",
        state: { ...original, channels: [streamEventChannel(first, described), first] },
      });
      const { page, errors } = await openPage(`basic-app/index.xhtml?events=${Date.now()}`);

      await runStreamEventScenario((fn, arg) => page.evaluate(fn, arg), {
        described,
        missing: broadcaster.url("stream-events/missing.ste"),
      });
      expect(errors).toEqual([]);
      await page.close();
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
      await broadcaster.close();
    }
  });

  it("with the default lineup, the broadcast is the test card the extension ships, on air", async () => {
    const { page, errors } = await openPage(`broadcast-app/index.xhtml?card=${Date.now()}`);

    await runShippedTestCardScenario((fn) => page.evaluate(fn));
    expect(errors).toEqual([]);
    await page.close();
  });

  it("the TV presents the broadcast behind the application, which a video/broadcast takes as it is (OIPF DAE Annex H)", async () => {
    const { ui } = await openUi();
    type UiState = { channels: (Channel & { mp4Source: string })[] };
    const request = (message: object) => ui.evaluate((m) => chrome.runtime.sendMessage(m), message);
    const getState = async () => ((await request({ _tag: "UI/GetState" })) as { state: UiState }).state;
    const original = await getState();
    const [first, ...others] = original.channels as [Channel & { mp4Source: string }];

    try {
      await request({
        _tag: "UI/SaveState",
        state: { ...original, channels: [localStreamChannel(first, server.url("av-app/clip.mp4")), ...others] },
      });
      const { page, errors } = await openPage(`broadcast-app/index.xhtml?layer=${Date.now()}`);

      await runBroadcastLayerScenario((fn) => page.evaluate(fn));
      expect(errors).toEqual([]);
      await page.close();
    } finally {
      await request({ _tag: "UI/SaveState", state: original });
    }
  });
});
