/**
 * The TV page (`tv.html?channel=<id>`): what a TV in TV mode shows on a channel
 * whose AIT starts no application, i.e. the broadcast alone, full screen, with the
 * channel banner a TV shows after a channel change.
 *
 * An extension page, not an HbbTV document: no page runtime runs here. Changing
 * channel (from the UI) loads the next channel's page in its place.
 * Menus, channel list and OSD come later (ROADMAP 2.3).
 *
 * The broadcast is on air before the page loads (a simulated live, `channelClock` in
 * `@hbb-emu/core`): a stream with a finite duration starts where its loop is on air.
 */

import { livePosition } from "@hbb-emu/core";
import type { ChannelConfig } from "@hbb-emu/extension-common";
import type { UiState } from "@hbb-emu/protocol";
import { pipe } from "fp-ts/function";
import type * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";

export type TvShellEnv = Readonly<{
  document: Document;
  /** The query of the page's URL, e.g. `?channel=radio`. */
  search: string;
  getState: () => TE.TaskEither<unknown, UiState>;
}>;

/** How long the banner stays after the page loads, in ms. */
export const BANNER_MS = 4000;

const STYLE = `
  html, body { margin: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
  video { position: fixed; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #000; }
  .banner {
    position: fixed; left: 48px; top: 40px; padding: 12px 24px; border-radius: 6px;
    background: rgba(0, 0, 0, 0.7); color: #fff; font: 600 28px/1.2 sans-serif;
    transition: opacity 0.6s; display: flex; gap: 16px;
  }
  .banner.hidden { opacity: 0; }
`;

const render = (document: Document, channels: ReadonlyArray<ChannelConfig>, channelId: string | null): void => {
  const index = channels.findIndex((channel) => channel.id === channelId);
  const channel = channels[index];

  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.appendChild(style);

  const banner = document.createElement("div");
  banner.className = "banner";
  document.body.dataset.channel = channel?.id ?? "";

  if (channel === undefined) {
    banner.textContent = "No signal";
    document.title = "TV";
  } else {
    const number = document.createElement("span");
    number.textContent = String(index + 1);
    const name = document.createElement("span");
    name.textContent = channel.name;
    banner.append(number, name);
    document.title = `${index + 1} ${channel.name}`;

    if (channel.mp4Source) {
      const video = document.createElement("video");
      video.src = channel.mp4Source;
      // Autoplay with sound needs a user gesture; the broadcast starts muted.
      video.muted = true;
      video.autoplay = true;
      video.loop = true;
      video.setAttribute("playsinline", "");
      video.addEventListener("loadedmetadata", () => {
        const position = livePosition(Date.now(), video.duration);
        if (position !== null) video.currentTime = position;
      });
      document.body.appendChild(video);
    }
  }

  document.body.appendChild(banner);
  setTimeout(() => banner.classList.add("hidden"), BANNER_MS);
};

/** Renders the channel named by the page's URL, as the lineup has it now. */
export const startTvShell = ({ document, search, getState }: TvShellEnv): T.Task<void> => {
  const channelId = new URLSearchParams(search).get("channel");
  return pipe(
    getState(),
    TE.match(
      () => render(document, [], channelId),
      (state) => render(document, state.channels, channelId),
    ),
  );
};
