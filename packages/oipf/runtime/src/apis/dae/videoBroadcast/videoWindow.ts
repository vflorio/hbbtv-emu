/**
 * `VideoWindow` backed by the `<object>` element, for the `visual-embedded` attach
 * (the video is mounted inside the object, see `subsystems/provider/detection/embedded.ts`).
 *
 * - size: OIPF defines `width`/`height` as the object's `style.width`/`style.height`,
 *   so writes go to the object's style and reads come from its computed style;
 * - full-screen: a marker attribute on the object, which the emulator stylesheet turns
 *   into a video `position: fixed` over the viewport. The object's style (and z-index) is
 *   untouched. On the object, not the video: the broadcast's video moves between objects
 *   and the TV (`subsystems/broadcastLayer.ts`), the mode is the object's.
 */

import type * as IO from "fp-ts/IO";
import { FULLSCREEN_ATTRIBUTE } from "../../../subsystems/provider/detection/embedded";
import type { Size, VideoWindow } from "./display";

/** `"640px"` → 640; anything else (`auto`, `""`, percentages not yet resolved) → 0. */
export const parsePixels = (value: string): number => {
  const pixels = Number.parseFloat(value);
  return value.trim().endsWith("px") && Number.isFinite(pixels) ? Math.trunc(pixels) : 0;
};

/** The object's size, from its computed style. */
export const readObjectSize =
  (object: HTMLObjectElement): IO.IO<Size> =>
  () => {
    const style = (object.ownerDocument.defaultView ?? window).getComputedStyle(object);
    return { width: parsePixels(style.width), height: parsePixels(style.height) };
  };

export const createObjectVideoWindow = (object: HTMLObjectElement): VideoWindow => ({
  getSize: readObjectSize(object),
  setWidth: (width) => () => {
    object.style.width = `${width}px`;
  },
  setHeight: (height) => () => {
    object.style.height = `${height}px`;
  },
  setFullScreen: (fullScreen) => () => {
    if (fullScreen) object.setAttribute(FULLSCREEN_ATTRIBUTE, "");
    else object.removeAttribute(FULLSCREEN_ATTRIBUTE);
  },
});
