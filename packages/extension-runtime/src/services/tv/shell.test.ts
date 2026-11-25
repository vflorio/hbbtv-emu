import { DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import * as TE from "fp-ts/TaskEither";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BANNER_MS, startTvShell } from "./shell";

const radio = { ...DEFAULT_EXTENSION_STATE.channels[0]!, id: "radio", name: "Radio", mp4Source: "http://tv/radio.mp4" };
const state = { ...DEFAULT_EXTENSION_STATE, channels: [DEFAULT_EXTENSION_STATE.channels[0]!, radio] };

const show = async (search: string, getState = () => TE.right(state)) => {
  const document = window.document.implementation.createHTMLDocument("");
  await startTvShell({ document, search, getState })();
  return document;
};

describe("TV page", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the channel's broadcast, muted (no user gesture yet), and its number and name", async () => {
    const document = await show("?channel=radio");

    const video = document.querySelector("video");
    expect(video?.getAttribute("src")).toBe("http://tv/radio.mp4");
    expect(video?.muted).toBe(true);
    expect(document.querySelector(".banner")?.textContent).toBe("2Radio");
    expect(document.body.dataset.channel).toBe("radio");
  });

  it("hides the banner after a while", async () => {
    const document = await show("?channel=radio");

    vi.advanceTimersByTime(BANNER_MS);

    expect(document.querySelector(".banner")?.classList.contains("hidden")).toBe(true);
  });

  it("shows no signal for a channel that is not in the lineup, or without the background", async () => {
    expect((await show("?channel=gone")).querySelector(".banner")?.textContent).toBe("No signal");
    expect((await show("?channel=radio", () => TE.left("unreachable"))).querySelector("video")).toBeNull();
  });
});
