/**
 * Real HbbTV applications, on the Internet, in the emulator (chrome-v3).
 *
 * Opt-in: they depend on the network and on sites that change without notice, so they
 * run only with `HBB_EMU_REAL_APPS=1` (after `bun run extension:build`). They use the
 * extension's default lineup, which carries each application's channel and AIT.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Frame, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ExtensionBrowser, launchWithExtension } from "./support/browser";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION_DIR = join(root, "../extensions/chrome-v3/dist");

const enabled = process.env.HBB_EMU_REAL_APPS === "1";

let browser: ExtensionBrowser;

beforeAll(async () => {
  if (!enabled) return;
  browser = await launchWithExtension(EXTENSION_DIR);
  await browser.allowUserScripts();
});

afterAll(async () => {
  await browser?.close();
});

/** Records every `PlayStateChange` of the page's `video/broadcast` objects, from before the first script. */
const recordBroadcastStates = () => {
  const states: number[] = [];
  Object.assign(window, { __broadcastStates: states });
  // The event does not bubble: a capturing listener on the document still sees it.
  document.addEventListener(
    "PlayStateChange",
    (event) => {
      const target = event.target as Element | null;
      if (target?.getAttribute("type") === "video/broadcast") states.push((event as Event & { state: number }).state);
    },
    true,
  );
};

const broadcastStates = (page: Page) =>
  page.evaluate(() => (window as unknown as { __broadcastStates: number[] }).__broadcastStates);

/** Whether a media element of the application (not the broadcast's) plays, in any frame. */
const applicationMediaPlays = async (page: Page): Promise<boolean> => {
  const inFrame = (frame: Frame) =>
    frame
      .evaluate(() =>
        Array.from(document.querySelectorAll("video, audio")).some((element) => {
          const media = element as HTMLMediaElement;
          return !media.closest("object") && !media.paused && media.currentTime > 1;
        }),
      )
      .catch(() => false);
  return (await Promise.all(page.frames().map(inFrame))).some(Boolean);
};

describe.skipIf(!enabled)("real applications (HBB_EMU_REAL_APPS=1)", () => {
  it("DMAX: broadcast on DMAX, consent, launcher, an on-demand video, then back to live", async () => {
    const page = await browser.context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`${error.message}\n${error.stack ?? ""}`));
    // The application's own errors are its own (Galaxy, for one, races itself when UP comes early): only
    // those thrown by the emulator's code (its frame on top of the stack) fail the test.
    const emulatorErrors = () =>
      errors.filter((error) =>
        error
          .split("\n")
          .find((line) => line.trim().startsWith("at "))
          ?.includes("chrome-extension://"),
      );
    await page.addInitScript(recordBroadcastStates);
    await page.goto("http://it.container.enhanced.live/dmax");

    // The AIT of DMAX signals the application: the TV is on DMAX, and the broadcast presents.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const object = document.getElementById("broadcastVideoObject") as unknown as {
              playState: number;
              currentChannel: { onid: number; tsid: number; sid: number } | null;
            };
            const channel = object.currentChannel;
            return { playState: object.playState, triplet: channel && [channel.onid, channel.tsid, channel.sid] };
          }),
        { timeout: 15_000 },
      )
      .toEqual({ playState: 2, triplet: [12289, 516, 10] });

    // The consent banner comes first; OK accepts it, and the other bundles load (the launcher among them).
    await page.locator("#cmp").getByText("Accetto").waitFor({ timeout: 15_000 });
    await page.keyboard.press("Enter");
    await page.locator("#root-galaxy").waitFor({ state: "attached", timeout: 15_000 });

    // Bound to what the TV presents, the broadcast presents at once and keeps presenting (OIPF DAE Table 8):
    // neither the TV's start-up nor the DASH source's own states are play states.
    expect(await broadcastStates(page)).toEqual([2]);

    // UP is the launcher's key. What it does depends on WBD's launcher schedule and on when it comes:
    // with the launcher's banner up it runs the banner's action (e.g. start-over of the programme), with
    // the banner gone it opens the catalogue, where OK plays the focused item. Either way the
    // application's player ends up playing a video (pre-roll ads first). The launcher listens only once
    // started, so the keys are pressed again until something plays.
    await expect
      .poll(
        async () => {
          if (await applicationMediaPlays(page)) return true;
          const path = new URL(page.url()).pathname;
          if (path === "/dmax") await page.keyboard.press("ArrowUp");
          else if (path === "/hbbtv-dmax") await page.keyboard.press("Enter");
          return false;
        },
        { timeout: 60_000, interval: 5_000 },
      )
      .toBe(true);

    // Back to live. DMAX stops the broadcast while its player plays (`stop()`); BACK closes the
    // player (the start-over one asks first: ← and OK on "ESCI"), and a second later DMAX binds
    // the object again (`bindToCurrentChannel()` from STOPPED): the channel presents again,
    // where it is on air.
    expect(await broadcastStates(page)).toEqual([2, 3]);
    await expect
      .poll(
        async () => {
          if (await page.getByText("Sei sicuro di voler uscire?").isVisible()) {
            await page.keyboard.press("ArrowLeft");
            await page.keyboard.press("Enter");
          } else if (await applicationMediaPlays(page)) {
            await page.keyboard.press("Backspace");
          }
          return page.evaluate(() => {
            const object = document.getElementById("broadcastVideoObject") as unknown as { playState: number };
            const video = document.querySelector("#broadcastVideoObject > video") as HTMLVideoElement | null;
            if (!video || video.paused || !Number.isFinite(video.duration)) return { playState: object.playState };
            const drift = Math.abs(video.currentTime - ((Date.now() / 1000) % video.duration));
            return { playState: object.playState, onAir: Math.min(drift, video.duration - drift) < 1 };
          });
        },
        { timeout: 30_000, interval: 2_500 },
      )
      .toEqual({ playState: 2, onAir: true });
    expect(await broadcastStates(page)).toEqual([2, 3, 1, 2]);
    expect(await applicationMediaPlays(page)).toBe(false);

    if (errors.length > emulatorErrors().length) console.info("DMAX's own errors:", errors);
    expect(emulatorErrors()).toEqual([]);
    await page.close();
  }, 120_000);
});
