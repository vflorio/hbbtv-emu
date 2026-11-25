/**
 * `VideoWindow` for an A/V Control object, which still uses the legacy `visual`
 * attach: the video lives in a container after the `<object>`, and the container
 * mirrors the object's inline style (see `subsystems/provider/detection/attach.ts`).
 *
 * - the video fills the container;
 * - size: written to, and read from, the object's style, as for video/broadcast;
 * - full-screen: the video covers the viewport (`position: fixed`).
 */

import type { VideoWindow } from "../../dae/videoBroadcast/display";
import { readObjectSize } from "../../dae/videoBroadcast/videoWindow";

const WINDOWED = { position: "", left: "", top: "", width: "100%", height: "100%" } as const;
const FULL_SCREEN = { position: "fixed", left: "0", top: "0", width: "100vw", height: "100vh" } as const;

const layOut = (video: HTMLVideoElement, layout: typeof WINDOWED | typeof FULL_SCREEN): void => {
  for (const [property, value] of Object.entries(layout)) video.style.setProperty(property, value);
};

export const createContainerVideoWindow = (object: HTMLObjectElement, video: HTMLVideoElement): VideoWindow => {
  video.style.setProperty("display", "block");
  video.style.setProperty("background", "#000");
  layOut(video, WINDOWED);

  return {
    getSize: readObjectSize(object),
    setWidth: (width) => () => {
      object.style.width = `${width}px`;
    },
    setHeight: (height) => () => {
      object.style.height = `${height}px`;
    },
    setFullScreen: (fullScreen) => () => layOut(video, fullScreen ? FULL_SCREEN : WINDOWED),
  };
};
