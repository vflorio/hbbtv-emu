/**
 * The broadcast layer scenario both hosts run on `broadcast-app/index.xhtml` (OIPF DAE
 * Annex H, Table 8; TS 102 796 §6.2.2.3), on a channel whose stream is a local clip:
 *
 * - an object the application binds at its first script presents at once, and stays
 *   presenting while the TV's stream starts;
 * - released, the TV presents the broadcast behind the application, over the whole
 *   viewport, without loading it again; the application's queries do not find it;
 * - bound, an object takes the same video into its window; a created object bound before
 *   it is inserted gets it once inserted;
 * - an opaque background of the page hides the video plane.
 */

import { expect } from "vitest";
import type { Evaluate } from "./avControl";

type Where = { in: string; playing: boolean; time: number; visible: boolean; loads: number };
type Broadcast = HTMLObjectElement & {
  playState: number;
  bindToCurrentChannel: () => unknown;
  release: () => void;
  setFullScreen: (fullScreen: boolean) => void;
};
type BroadcastAppState = {
  initError: string | null;
  earlyBound: boolean;
  earlyPlayStateAtFirstScript: number;
  states: { early: number[]; video: number[] };
};

/** A channel of the lineup whose stream is `streamUrl`, in place of the first one. */
export const localStreamChannel = <C extends { mp4Source: string }>(channel: C, streamUrl: string) => ({
  ...channel,
  mp4Source: streamUrl,
});

const until = async (evaluate: Evaluate, fn: () => boolean, what: string, timeout = 15_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(fn)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${what}`);
};

const app = (evaluate: Evaluate) => evaluate(() => (window as unknown as { __e2e: BroadcastAppState }).__e2e);

/** In the page: where the broadcast's video is (`layer`, or its object's id), and how it plays. */
const installProbe = () => {
  const probe = window as unknown as Record<string, unknown>;
  const layer = () => document.querySelector("[data-hbbtv-emu-broadcast]") as HTMLElement | null;
  const video = () =>
    (layer()?.shadowRoot?.querySelector("video") ??
      document.querySelector("object > video[data-hbbtv-emu-video]")) as HTMLVideoElement | null;
  let loads = 0;
  video()?.addEventListener("loadstart", () => {
    loads += 1;
  });
  probe.__layer = layer;
  probe.__where = (): Where => {
    const element = video();
    if (!element) return { in: "nowhere", playing: false, time: 0, visible: false, loads };
    const parent = element.parentNode;
    return {
      in: parent instanceof ShadowRoot ? "layer" : (parent as Element).id,
      playing: !element.paused && element.readyState >= 2,
      time: element.currentTime,
      visible: element.style.visibility !== "hidden",
      loads,
    };
  };
};

const where = (evaluate: Evaluate) => evaluate(() => (window as unknown as { __where: () => Where }).__where());

/** The video plays on, a little further: it was not loaded again. */
const playsOn = async (evaluate: Evaluate, place: string) => {
  const before = await where(evaluate);
  expect(before).toMatchObject({ in: place, visible: true, loads: 0 });
  await new Promise((resolve) => setTimeout(resolve, 400));
  const after = await where(evaluate);
  expect(after).toMatchObject({ in: place, playing: true, visible: true, loads: 0 });
  // A looping 3 s clip: further on, or round again.
  expect(after.time).not.toBe(before.time);
};

export const runBroadcastLayerScenario = async (evaluate: Evaluate) => {
  expect(await app(evaluate)).toMatchObject({ initError: null, earlyBound: true, earlyPlayStateAtFirstScript: 2 });

  // Bound at the first script, the object presents at once; the TV's start-up is no state change.
  await until(
    evaluate,
    () => {
      const layer = document.querySelector("[data-hbbtv-emu-broadcast]");
      const video = layer?.shadowRoot?.querySelector("video") ?? document.querySelector("#early > video");
      return video instanceof HTMLVideoElement && !video.paused && video.readyState >= 2;
    },
    "the broadcast playing",
  );
  await evaluate(installProbe);
  await playsOn(evaluate, "early");
  expect((await app(evaluate)).states.early).toEqual([2]);

  // Released, the TV presents it behind the application, over the whole viewport.
  await evaluate(() => (document.getElementById("early") as Broadcast).release());
  await playsOn(evaluate, "layer");
  const layout = await evaluate(() => {
    const layer = (window as unknown as { __layer: () => HTMLElement }).__layer();
    const style = getComputedStyle(layer);
    const rect = layer.getBoundingClientRect();
    return {
      parent: layer.parentElement?.tagName.toLowerCase(),
      position: style.position,
      zIndex: style.zIndex,
      rect: [rect.left, rect.top, rect.width, rect.height],
      viewport: [0, 0, window.innerWidth, window.innerHeight],
      videosTheApplicationFinds: document.querySelectorAll("video").length,
    };
  });
  expect(layout).toMatchObject({ parent: "html", position: "fixed", zIndex: "-2147483648" });
  expect(layout.rect).toEqual(layout.viewport);
  expect(layout.videosTheApplicationFinds).toBe(0);
  expect((await app(evaluate)).states.early).toEqual([2, 0]);

  // Another object binds: the same video, in its window, presenting at once (Table 8).
  const bound = await evaluate(() => {
    const object = document.getElementById("video") as Broadcast;
    const before = object.playState;
    const channel = object.bindToCurrentChannel();
    return { before, channel: channel !== null, after: object.playState };
  });
  expect(bound).toEqual({ before: 0, channel: true, after: 2 });
  await playsOn(evaluate, "video");
  const windowed = await evaluate(() => {
    const object = document.getElementById("video") as Broadcast;
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return [rect.left, rect.top, rect.width, rect.height];
    };
    const video = object.querySelector("video") as HTMLVideoElement;
    const inWindow = box(video);
    object.setFullScreen(true);
    const fullScreen = box(video);
    object.setFullScreen(false);
    object.release();
    return { inWindow, fullScreen, viewport: [0, 0, window.innerWidth, window.innerHeight] };
  });
  expect(windowed.inWindow).toEqual([640, 360, 640, 360]);
  expect(windowed.fullScreen).toEqual(windowed.viewport);
  expect((await app(evaluate)).states.video).toEqual([2, 0]);
  await playsOn(evaluate, "layer");

  // An object created and bound out of the document gets the video once inserted.
  await evaluate(() => {
    const factory = (window as unknown as { oipfObjectFactory: { createVideoBroadcastObject: () => Broadcast } })
      .oipfObjectFactory;
    const object = factory.createVideoBroadcastObject();
    object.id = "created";
    object.setAttribute("style", "position: absolute; left: 0; top: 360px; width: 320px; height: 180px");
    object.bindToCurrentChannel();
    document.body.appendChild(object);
  });
  await until(evaluate, () => document.querySelector("#created > video") !== null, "the created object's video");
  await playsOn(evaluate, "created");
  await evaluate(() => (document.getElementById("created") as Broadcast).release());
  await playsOn(evaluate, "layer");

  // An opaque page background hides the video plane (Annex H.1), a transparent one shows it.
  const display = () =>
    evaluate(() => getComputedStyle((window as unknown as { __layer: () => HTMLElement }).__layer()).display);
  await evaluate(() => {
    document.body.style.backgroundColor = "rgb(0, 0, 40)";
  });
  await until(
    evaluate,
    () => getComputedStyle((window as unknown as { __layer: () => HTMLElement }).__layer()).display === "none",
    "the layer hidden",
  );
  await evaluate(() => {
    document.body.style.backgroundColor = "transparent";
  });
  await until(
    evaluate,
    () => getComputedStyle((window as unknown as { __layer: () => HTMLElement }).__layer()).display === "block",
    "the layer shown",
  );
  expect(await display()).toBe("block");
};
