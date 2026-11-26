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
 * An MPD can be the source in three ways, as any media in HTML:
 * - the `src` property;
 * - the `src` attribute, in the markup (`<video src="….mpd">`) or from
 *   `setAttribute()`, seen by a MutationObserver once the element is in the document;
 * - a `<source>` child, when the element has no `src` attribute and the first
 *   `<source>` the browser would choose (HTML's resource selection: in order, the first
 *   whose `type` it can play, or with no `type`) is an MPD. It is chosen when the
 *   element enters the document, when a `<source>` is added to an element that
 *   presents nothing, and at `load()`. `src` then reads "" and `currentSrc` the MPD.
 *
 * Pending mutations are taken at once by the accessors and `load()`
 * (`takeRecords()`), so a `setAttribute("src", …)` followed by `load()` is seen in
 * that order.
 *
 * - An MPD is a URL whose path ends in `.mpd`, or a `<source>` of type
 *   `application/dash+xml` (the emulator's choice: a terminal looks at the content
 *   type of the answer, which the page cannot read before it loads).
 * - A new `src`, even the same one, starts the presentation over, as in HTML; a source
 *   that is not an MPD ends it, and the browser plays that one.
 * - `load()` starts it over too. Once the application took the source away
 *   (`removeAttribute("src")`, then `load()`, the HTML way of unloading a media), it
 *   ends, and the element is empty, or plays what its `<source>` children choose.
 * - A fatal error of dash.js is the element's `error`, with an `error` event, as the
 *   browser reports a source of its own (`dashMediaErrorCode`).
 * - `canPlayType("application/dash+xml")` is "maybe", or "probably" when the browser
 *   plays every codec of the `codecs` parameter (HTML: "probably" only with codecs).
 *
 * The videos of the OIPF objects are left alone (`EmulatorMedia`): their player
 * chooses an adapter itself.
 *
 * Not covered: an MPD in the `src` attribute of an element outside the document (no
 * mutation is seen until it is inserted); `getAttribute("src")`, which reads dash.js's
 * object URL once it is attached. The browser has started on a source of the markup
 * before the observer sees it: it can fire `loadstart`, `abort` or `emptied` before
 * dash.js's own events, `error` at a DASH `<source>` it cannot play, and begin a
 * `<source>` after it, until dash.js attaches its MediaSource.
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

/** Where the application gave the MPD: the element's `src` (property or attribute), or a `<source>`. */
type Origin = "src" | "source";

type Presentation = {
  /** The MPD: what `currentSrc` reads, and `src` too when it came from there. */
  url: string;
  origin: Origin;
  dash: MediaElementDash;
  /** Whether dash.js's MediaSource is the element's source by now. */
  attached: boolean;
  /** The `src` attribute dash.js wrote last (its object URL): not the application's. */
  written: string | null;
  error: MediaError | null;
};

/**
 * Installs the accessors and the observer; returns the effect that restores the
 * browser's. Without the accessors to wrap, it changes nothing.
 */
export const installMediaElementDash: RIO.ReaderIO<MediaElementDashEnv, IO.IO<void>> = (env) => () => {
  const { window } = env;
  const prototype = window.HTMLMediaElement.prototype;
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
    Object.create(window.MediaError?.prototype ?? Object.prototype, {
      code: { value: code, enumerable: true },
      message: { value: message, enumerable: true },
    });

  const mpd = (value: string): string | null => {
    const url = absoluteUrl(value, window.document.baseURI);
    return url && isMpdUrl(url) ? url.href : null;
  };

  /** The `src` attribute the application gave, not dash.js; `null` without one. */
  const applicationAttribute = (element: HTMLMediaElement): string | null => {
    const value = element.getAttribute("src");
    return value !== null && value !== presentations.get(element)?.written ? value : null;
  };

  /** The MPD of the `<source>` the browser would choose, as HTML's resource selection does; `null` for none. */
  const chosenSource = (element: HTMLMediaElement): string | null => {
    for (const child of Array.from(element.children)) {
      if (child.localName !== "source") continue;
      const value = child.getAttribute("src");
      if (!value) continue;
      const type = child.getAttribute("type");
      if (type !== null && type.trim() !== "") {
        const dash = canPlayDash(type, env.engine.isTypeSupported);
        if (dash !== null) {
          if (dash === "") continue;
          return absoluteUrl(value, window.document.baseURI)?.href ?? null;
        }
        if (nativeCanPlayType.call(element, type) === "") continue;
        return null;
      }
      return mpd(value);
    }
    return null;
  };

  const end = (element: HTMLMediaElement, presentation: Presentation) => {
    presentations.delete(element);
    presentation.dash.reset();
  };

  const present = (element: HTMLMediaElement, url: string, origin: Origin) => {
    // The media the browser was presenting from the application's attribute ends here,
    // as with any new source.
    if (applicationAttribute(element) !== null) {
      element.removeAttribute("src");
      nativeLoad.call(element);
    }
    const current = presentations.get(element);
    if (current) {
      current.url = url;
      current.origin = origin;
      current.error = null;
      current.dash.attachSource(url);
      return;
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
    const presentation: Presentation = { url, origin, dash, attached: false, written: null, error: null };
    presentations.set(element, presentation);
    dash.attachSource(url);
    logger.info(`Presenting ${url} with dash.js`)();
  };

  /** An element whose `src` attribute or `<source>` children may have changed, in the document. */
  const review = (element: HTMLMediaElement) => {
    if (browserOnly(element)) return;
    const presentation = presentations.get(element);
    const attribute = applicationAttribute(element);
    if (attribute !== null) {
      const url = mpd(attribute);
      if (url !== null) {
        present(element, url, "src");
      } else if (presentation) {
        // The browser plays the application's source: dash.js lets the element go first.
        end(element, presentation);
        element.setAttribute("src", attribute);
      }
      return;
    }
    // A `<source>` is chosen only by an element that presents nothing.
    if (presentation || element.hasAttribute("src")) return;
    const url = chosenSource(element);
    if (url !== null) present(element, url, "source");
  };

  const isMedia = (node: Node | null): node is HTMLMediaElement => node instanceof window.HTMLMediaElement;

  const handle = (records: MutationRecord[]) => {
    const elements = new Set<HTMLMediaElement>();
    for (const record of records) {
      if (record.type === "attributes") {
        if (isMedia(record.target)) elements.add(record.target);
        continue;
      }
      for (const node of Array.from(record.addedNodes)) {
        if (isMedia(node)) elements.add(node);
        else if (node instanceof window.Element && node.localName === "source" && isMedia(record.target))
          elements.add(record.target);
        if (node instanceof window.Element)
          for (const media of Array.from(node.querySelectorAll("video, audio"))) {
            if (isMedia(media)) elements.add(media);
          }
      }
    }
    for (const element of elements) if (element.isConnected) review(element);
  };

  const observer = new window.MutationObserver(handle);
  observer.observe(window.document, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });
  // What the observer has not delivered yet, before an accessor or `load()` answers.
  const flush = () => handle(observer.takeRecords());

  Object.defineProperty(prototype, "src", {
    configurable: true,
    enumerable: src.enumerable,
    get(this: HTMLMediaElement) {
      if (browserOnly(this)) return nativeSrc.get.call(this);
      flush();
      const presentation = presentations.get(this);
      if (!presentation) return nativeSrc.get.call(this);
      return presentation.origin === "src" ? presentation.url : "";
    },
    set(this: HTMLMediaElement, value: unknown) {
      if (browserOnly(this)) {
        nativeSrc.set.call(this, value);
        const presentation = presentations.get(this);
        if (presentation) {
          presentation.attached = this.hasAttribute("src");
          presentation.written = this.getAttribute("src");
        }
        return;
      }
      flush();
      const url = mpd(String(value));
      if (url !== null) {
        present(this, url, "src");
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
      flush();
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
      if (browserOnly(this)) {
        nativeLoad.call(this);
        const presentation = presentations.get(this);
        if (presentation) presentation.attached = this.hasAttribute("src");
        return;
      }
      flush();
      let presentation = presentations.get(this);
      // Right after a new source: dash.js is already on its way to the media.
      if (presentation && !presentation.attached) return;
      if (presentation?.origin === "src") {
        if (this.hasAttribute("src")) {
          presentation.error = null;
          presentation.dash.attachSource(presentation.url);
          return;
        }
        // The application took its source away.
        end(this, presentation);
        presentation = undefined;
      }
      // As HTML's resource selection: the `src` attribute, otherwise the `<source>` children.
      if (!presentation && this.hasAttribute("src")) {
        nativeLoad.call(this);
        return;
      }
      const url = chosenSource(this);
      if (url !== null) {
        present(this, url, "source");
        return;
      }
      if (presentation) end(this, presentation);
      nativeLoad.call(this);
    },
    canPlayType(this: HTMLMediaElement, type: string) {
      if (browserOnly(this)) return nativeCanPlayType.call(this, type);
      return canPlayDash(String(type), env.engine.isTypeSupported) ?? nativeCanPlayType.call(this, type);
    },
  };
  Object.defineProperty(prototype, "load", { ...load, value: wrapped.load });
  Object.defineProperty(prototype, "canPlayType", { ...canPlayType, value: wrapped.canPlayType });

  return () => {
    observer.disconnect();
    Object.defineProperty(prototype, "src", src);
    Object.defineProperty(prototype, "currentSrc", currentSrc);
    Object.defineProperty(prototype, "error", error);
    Object.defineProperty(prototype, "load", load);
    Object.defineProperty(prototype, "canPlayType", canPlayType);
  };
};
