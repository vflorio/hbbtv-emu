/**
 * DASH in the application's own `<video>` and `<audio>` (TS 102 796 §9.4.2, A.2.12).
 *
 * An HbbTV 2 terminal plays an MPD set as the source of an HTML5 media element, as
 * VOD applications do (`video.src = "….mpd"; video.play()`). No desktop browser has
 * DASH of its own: there the element fails with MEDIA_ERR_SRC_NOT_SUPPORTED. So the
 * element's `src` is replaced before the application's first script: an MPD is
 * presented with dash.js (`MediaElementDashEngine`) on the same element, and the
 * application reads back the URL it set (`src`, `currentSrc`), not the object URL of
 * dash.js's MediaSource. Any other source is the browser's, as before.
 *
 * - An MPD is a URL whose path ends in `.mpd` (the emulator's choice: a terminal looks
 *   at the content type of the answer, which the page cannot read before it loads).
 * - A new `src`, even the same one, starts the presentation over, as in HTML; a source
 *   that is not an MPD ends it, and the browser plays that one.
 * - `load()` starts it over too. Once the application took the source away
 *   (`removeAttribute("src")`, then `load()`, the HTML way of unloading a media), it
 *   ends, and the element is empty.
 * - A fatal error of dash.js is the element's `error`, with an `error` event, as the
 *   browser reports a source of its own (`dashMediaErrorCode`).
 * - `canPlayType("application/dash+xml")` is "maybe", or "probably" when the browser
 *   plays every codec of the `codecs` parameter (HTML: "probably" only with codecs).
 *
 * The videos of the OIPF objects are left alone (`EmulatorMedia`): their player
 * chooses an adapter itself.
 *
 * Not yet covered: an MPD in the markup (`<video src="….mpd">`) or in a `<source>`;
 * `getAttribute("src")`, which reads dash.js's object URL once it is attached.
 */

import { createLogger } from "@hbb-emu/core";
import type { MediaElementDash, MediaElementDashEngine } from "@hbb-emu/player-adapter-web";
import type * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import type { EmulatorMedia } from "./mediaElementVolume";

const logger = createLogger("MediaElementDash");

export type MediaElementDashEnv = Readonly<{
  window: Window & typeof globalThis;
  emulatorMedia: EmulatorMedia;
  engine: MediaElementDashEngine;
}>;

export const DASH_MIME_TYPE = "application/dash+xml";

/** The absolute URL of a source, as the element's `src` reflects it; `null` if it is not one. */
const absoluteUrl = (value: string, base: string): URL | null => {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
};

export const isMpdUrl = (url: URL): boolean => /\.mpd$/i.test(url.pathname);

/** The answer of `canPlayType` for a DASH type, `null` for any other type. */
export const canPlayDash = (type: string, isTypeSupported: (type: string) => boolean): CanPlayTypeResult | null => {
  const [essence = "", ...parameters] = type.split(";");
  if (essence.trim().toLowerCase() !== DASH_MIME_TYPE) return null;
  const codecs = parameters
    .map((parameter) => /^\s*codecs\s*=\s*"?([^"]*)"?\s*$/i.exec(parameter)?.[1])
    .find((value) => value !== undefined);
  if (codecs === undefined) return "maybe";
  const list = codecs
    .split(",")
    .map((codec) => codec.trim())
    .filter((codec) => codec !== "");
  // The segments of an HbbTV MPD are ISOBMFF (TS 103 285): each codec, in video or audio.
  const plays = (codec: string) =>
    isTypeSupported(`video/mp4; codecs="${codec}"`) || isTypeSupported(`audio/mp4; codecs="${codec}"`);
  return list.length > 0 && list.every(plays) ? "probably" : "";
};

type Presentation = {
  /** The source the application set: what `src` and `currentSrc` read. */
  url: string;
  dash: MediaElementDash;
  /** Whether dash.js's MediaSource is the element's source by now. */
  attached: boolean;
  error: MediaError | null;
};

/**
 * Installs the accessors; returns the effect that restores the browser's. Without the
 * accessors to wrap, it changes nothing.
 */
export const installMediaElementDash: RIO.ReaderIO<MediaElementDashEnv, IO.IO<void>> = (env) => () => {
  const prototype = env.window.HTMLMediaElement.prototype;
  const src = Object.getOwnPropertyDescriptor(prototype, "src");
  const currentSrc = Object.getOwnPropertyDescriptor(prototype, "currentSrc");
  const error = Object.getOwnPropertyDescriptor(prototype, "error");
  const load = Object.getOwnPropertyDescriptor(prototype, "load");
  const canPlayType = Object.getOwnPropertyDescriptor(prototype, "canPlayType");
  if (
    !src?.get ||
    !src.set ||
    !currentSrc?.get ||
    !error?.get ||
    typeof load?.value !== "function" ||
    typeof canPlayType?.value !== "function"
  ) {
    logger.warn("HTMLMediaElement has no source accessors: the application's media cannot present DASH")();
    return () => {};
  }
  const nativeSrc = { get: src.get, set: src.set };
  const nativeCurrentSrc = currentSrc.get;
  const nativeError = error.get;
  const nativeLoad = load.value as HTMLMediaElement["load"];
  const nativeCanPlayType = canPlayType.value as HTMLMediaElement["canPlayType"];

  const presentations = new WeakMap<HTMLMediaElement, Presentation>();

  // dash.js's own writes to an element's source go to the browser (`internally`).
  let internal = 0;
  const internally = (write: () => void) => {
    internal++;
    try {
      write();
    } finally {
      internal--;
    }
  };
  const browserOnly = (element: HTMLMediaElement) => internal > 0 || env.emulatorMedia.has(element);

  const mediaError = (code: number, message: string): MediaError =>
    Object.create(env.window.MediaError?.prototype ?? Object.prototype, {
      code: { value: code, enumerable: true },
      message: { value: message, enumerable: true },
    });

  const end = (element: HTMLMediaElement, presentation: Presentation) => {
    presentations.delete(element);
    presentation.dash.reset();
  };

  const present = (element: HTMLMediaElement, url: string) => {
    const current = presentations.get(element);
    if (current) {
      current.url = url;
      current.error = null;
      current.dash.attachSource(url);
      return;
    }
    // The media the browser was presenting ends here, as with any new source.
    if (element.hasAttribute("src")) {
      element.removeAttribute("src");
      nativeLoad.call(element);
    }
    // dash.js reports errors once it is loading, after `presentation` is set.
    const dash = env.engine.create(element, {
      internally,
      onError: (code, message) => {
        // One error per source, as the browser has: dash.js can report one failure twice.
        if (presentations.get(element) !== presentation || presentation.error) return;
        logger.warn(`DASH presentation of ${presentation.url} failed (MediaError ${code}): ${message}`)();
        presentation.error = mediaError(code, message);
        element.dispatchEvent(new Event("error"));
      },
    });
    const presentation: Presentation = { url, dash, attached: false, error: null };
    presentations.set(element, presentation);
    dash.attachSource(url);
    logger.info(`Presenting ${url} with dash.js`)();
  };

  Object.defineProperty(prototype, "src", {
    configurable: true,
    enumerable: src.enumerable,
    get(this: HTMLMediaElement) {
      if (browserOnly(this)) return nativeSrc.get.call(this);
      return presentations.get(this)?.url ?? nativeSrc.get.call(this);
    },
    set(this: HTMLMediaElement, value: unknown) {
      if (browserOnly(this)) {
        nativeSrc.set.call(this, value);
        const presentation = presentations.get(this);
        if (presentation) presentation.attached = this.hasAttribute("src");
        return;
      }
      const url = absoluteUrl(String(value), env.window.document.baseURI);
      if (url && isMpdUrl(url)) {
        present(this, url.href);
        return;
      }
      const presentation = presentations.get(this);
      if (presentation) end(this, presentation);
      nativeSrc.set.call(this, value);
    },
  });

  Object.defineProperty(prototype, "currentSrc", {
    configurable: true,
    enumerable: currentSrc.enumerable,
    get(this: HTMLMediaElement) {
      if (browserOnly(this)) return nativeCurrentSrc.call(this);
      return presentations.get(this)?.url ?? nativeCurrentSrc.call(this);
    },
  });

  Object.defineProperty(prototype, "error", {
    configurable: true,
    enumerable: error.enumerable,
    get(this: HTMLMediaElement) {
      if (browserOnly(this)) return nativeError.call(this);
      return presentations.get(this)?.error ?? nativeError.call(this);
    },
  });

  const wrapped = {
    load(this: HTMLMediaElement) {
      const presentation = presentations.get(this);
      if (browserOnly(this) || !presentation) {
        nativeLoad.call(this);
        if (presentation) presentation.attached = this.hasAttribute("src");
        return;
      }
      // Right after `src`: dash.js is already on its way to the media.
      if (!presentation.attached) return;
      if (!this.hasAttribute("src")) {
        end(this, presentation);
        nativeLoad.call(this);
        return;
      }
      presentation.error = null;
      presentation.dash.attachSource(presentation.url);
    },
    canPlayType(this: HTMLMediaElement, type: string) {
      if (browserOnly(this)) return nativeCanPlayType.call(this, type);
      return canPlayDash(String(type), env.engine.isTypeSupported) ?? nativeCanPlayType.call(this, type);
    },
  };
  Object.defineProperty(prototype, "load", { ...load, value: wrapped.load });
  Object.defineProperty(prototype, "canPlayType", { ...canPlayType, value: wrapped.canPlayType });

  return () => {
    Object.defineProperty(prototype, "src", src);
    Object.defineProperty(prototype, "currentSrc", currentSrc);
    Object.defineProperty(prototype, "error", error);
    Object.defineProperty(prototype, "load", load);
    Object.defineProperty(prototype, "canPlayType", canPlayType);
  };
};
