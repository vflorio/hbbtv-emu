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
 * - The MPD's events, and its segments' (`emsg`), are the element's TextTracks of kind
 *   "metadata", with a DataCue per event (§9.3.2.2, `./dashEvents`): the streams of
 *   every MPD dash.js loads, the segments' events as dash.js receives them; a new source
 *   or the end of the presentation empties them.
 * - `audioTracks` and `videoTracks` are the AdaptationSets (and Preselections) of the
 *   Period dash.js presents, as A.2.12.1 and A.2.12.3 map them (`./mediaTracks`):
 *   `id` the `@id`, `kind` from the Roles, `language` the `@lang` of the MPD, `label`
 *   ""; enabling an AudioTrack or selecting a VideoTrack switches dash.js to it. The
 *   browser has none of its own (only behind a flag), so the page gets them for every
 *   element, empty where dash.js presents nothing.
 * - The subtitle AdaptationSets dash.js offers are TextTracks (A.2.12.1), with the kind
 *   A.2.12.3 derives, label "", the MPD's language and the `@id` as `id`
 *   (`./mediaTracks`, `getTrackById()` finds them by it); disabled at first, their
 *   `mode` chooses which one dash.js fetches the cues of. A new source or the end of the
 *   presentation empties and disables them.
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
import type {
  DashTextTrack,
  DashTracks,
  DashTrackType,
  MediaElementDash,
  MediaElementDashEngine,
} from "@hbb-emu/player-adapter-web";
import type * as IO from "fp-ts/IO";
import type * as RIO from "fp-ts/ReaderIO";
import {
  createEventTracks,
  type EventTracks,
  inbandEventStreams,
  installDataCue,
  mpdEventStreams,
  type ReceivedInbandEvent,
} from "./dashEvents";
import type { EmulatorMedia } from "./mediaElementVolume";
import {
  audioKind,
  createSubtitleTracks,
  createTrackList,
  mpdTracks,
  type SubtitleTracks,
  type TrackInit,
  type TrackListControl,
  textKind,
  videoKind,
} from "./mediaTracks";

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

/** Whether two languages of dash.js (normalized BCP 47) are the same language: their primary subtags. */
const sameLanguage = (a: string, b: string): boolean => {
  const primary = (tag: string) => tag.split("-")[0]?.toLowerCase() ?? "";
  return primary(a) !== "" && primary(a) === primary(b);
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
  /** The last MPD dash.js loaded, as it came. */
  mpd: Document | null;
  /** The tracks of the Period dash.js presents, as it last said. */
  tracks: DashTracks | null;
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

  // The MPD's events, as TextTracks of the element that outlive its presentations.
  const dataCue = installDataCue(window);
  if (!dataCue) logger.warn("No VTTCue to make a DataCue from: the MPD's events do not reach the application")();
  const eventTracks = new WeakMap<HTMLMediaElement, EventTracks>();
  const serializer = new window.XMLSerializer();
  const tracksOf = (element: HTMLMediaElement, DataCue: NonNullable<typeof dataCue>["DataCue"]): EventTracks => {
    const existing = eventTracks.get(element);
    if (existing) return existing;
    const created = createEventTracks(element, DataCue);
    eventTracks.set(element, created);
    return created;
  };
  const showEvents = (element: HTMLMediaElement, dash: MediaElementDash, document: Document) => {
    if (!dataCue) return;
    try {
      const streams = mpdEventStreams(document, (node) => serializer.serializeToString(node));
      const inband = inbandEventStreams(document);
      for (const stream of inband) dash.followInband(stream.schemeIdUri);
      if (!eventTracks.has(element) && streams.length === 0 && inband.length === 0) return;
      tracksOf(element, dataCue.DataCue).update(streams, inband);
    } catch (cause) {
      logger.warn("The MPD's events could not be read", cause)();
    }
  };
  const showInbandEvent = (element: HTMLMediaElement, event: ReceivedInbandEvent) => {
    if (!dataCue) return;
    tracksOf(element, dataCue.DataCue).addInband(event, element.currentTime);
  };

  // The audio and video tracks (A.2.12.1): one list of each per element, as in HTML.
  const nativeAudioTracks = Object.getOwnPropertyDescriptor(prototype, "audioTracks");
  const nativeVideoTracks = Object.getOwnPropertyDescriptor(prototype, "videoTracks");
  const trackLists = new WeakMap<HTMLMediaElement, Record<DashTrackType, TrackListControl>>();
  const selectTrack = (element: HTMLMediaElement, type: DashTrackType, key: string) => {
    const presentation = presentations.get(element);
    const ref = key.slice(key.indexOf(" ") + 1);
    if (presentation && !presentation.dash.selectTrack(type, ref))
      logger.warn(`dash.js cannot present the ${type} track ${ref}`)();
  };
  const trackListsOf = (element: HTMLMediaElement): Record<DashTrackType, TrackListControl> => {
    const existing = trackLists.get(element);
    if (existing) return existing;
    const created = {
      audio: createTrackList("audio", { window, select: (key) => selectTrack(element, "audio", key) }),
      video: createTrackList("video", { window, select: (key) => selectTrack(element, "video", key) }),
    };
    trackLists.set(element, created);
    return created;
  };
  const showTracks = (element: HTMLMediaElement, presentation: Presentation) => {
    const tracks = presentation.tracks;
    if (!tracks) return;
    const fromMpd = presentation.mpd ? mpdTracks(presentation.mpd, tracks.period) : [];
    const position = new Map(fromMpd.map((track, index) => [track.ref, index]));
    const lang = new Map(fromMpd.map((track) => [track.ref, track.lang]));
    const inits = (type: DashTrackType): TrackInit[] =>
      [...tracks[type]]
        .sort(
          (a, b) => (position.get(a.ref) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.ref) ?? Number.MAX_SAFE_INTEGER),
        )
        .map((track) => ({
          key: `${tracks.period} ${track.ref}`,
          id: track.id,
          kind: type === "audio" ? audioKind(track.roles, track.audioPurposes) : videoKind(track.roles),
          label: "",
          language: lang.get(track.ref) ?? track.lang,
          on: tracks.current[type] === track.ref,
        }));
    const lists = trackListsOf(element);
    lists.audio.set(inits("audio"));
    lists.video.set(inits("video"));
  };
  const forgetTracks = (element: HTMLMediaElement) => {
    const lists = trackLists.get(element);
    lists?.audio.clear();
    lists?.video.clear();
    subtitles.get(element)?.clear();
  };

  // The subtitle tracks (A.2.12.1), TextTracks that outlive the presentations.
  const subtitles = new WeakMap<HTMLMediaElement, SubtitleTracks>();
  const subtitlesOf = (element: HTMLMediaElement): SubtitleTracks => {
    const existing = subtitles.get(element);
    if (existing) return existing;
    const created = createSubtitleTracks(element, (ref) => presentations.get(element)?.dash.selectText(ref));
    subtitles.set(element, created);
    return created;
  };
  const textTrackFor = (element: HTMLMediaElement, presentation: Presentation, track: DashTextTrack): TextTrack => {
    const fromMpd = presentation.mpd ? mpdTracks(presentation.mpd, track.period) : [];
    const kind = textKind(track.roles, {
      audioPurposes: track.audioPurposes,
      accessibility: track.accessibility,
      mainAudioInLanguage: track.audio.some(
        (audio) => audio.roles.includes("main") && sameLanguage(audio.lang, track.lang),
      ),
    });
    return subtitlesOf(element).track({
      ref: track.ref,
      id: track.id,
      kind,
      language: fromMpd.find((candidate) => candidate.ref === track.ref)?.lang ?? track.lang,
    });
  };

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
    eventTracks.get(element)?.clear();
    forgetTracks(element);
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
      current.mpd = null;
      current.tracks = null;
      eventTracks.get(element)?.clear();
      forgetTracks(element);
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
      onManifest: (text) => {
        if (presentations.get(element) !== presentation) return;
        presentation.mpd = new window.DOMParser().parseFromString(text, "application/xml");
        showEvents(element, dash, presentation.mpd);
        showTracks(element, presentation);
      },
      onTracks: (tracks) => {
        if (presentations.get(element) !== presentation) return;
        presentation.tracks = tracks;
        showTracks(element, presentation);
      },
      onInbandEvent: (event) => {
        if (presentations.get(element) === presentation) showInbandEvent(element, event);
      },
      onTextTrack: (track) =>
        presentations.get(element) === presentation ? textTrackFor(element, presentation, track) : null,
    });
    const presentation: Presentation = {
      url,
      origin,
      dash,
      attached: false,
      written: null,
      error: null,
      mpd: null,
      tracks: null,
    };
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

  for (const [name, native] of [
    ["audioTracks", nativeAudioTracks],
    ["videoTracks", nativeVideoTracks],
  ] as const) {
    const type: DashTrackType = name === "audioTracks" ? "audio" : "video";
    Object.defineProperty(prototype, name, {
      configurable: true,
      enumerable: true,
      get(this: HTMLMediaElement) {
        // The browser's own, where it has them, for what dash.js does not present.
        if (native?.get && !presentations.has(this)) return native.get.call(this);
        return trackListsOf(this)[type].list;
      },
    });
  }

  // The `id` of a subtitle track is its own property: the browser's lookup does not see it.
  const textTrackList = window.TextTrackList?.prototype;
  const getTrackById = textTrackList ? Object.getOwnPropertyDescriptor(textTrackList, "getTrackById") : undefined;
  if (textTrackList && typeof getTrackById?.value === "function")
    Object.defineProperty(textTrackList, "getTrackById", {
      ...getTrackById,
      value(this: TextTrackList, id: unknown) {
        for (let index = 0; index < this.length; index++) {
          const track = this[index];
          if (track && track.id === String(id)) return track;
        }
        return null;
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
    dataCue?.uninstall();
    Object.defineProperty(prototype, "src", src);
    Object.defineProperty(prototype, "currentSrc", currentSrc);
    Object.defineProperty(prototype, "error", error);
    for (const [name, native] of [
      ["audioTracks", nativeAudioTracks],
      ["videoTracks", nativeVideoTracks],
    ] as const) {
      if (native) Object.defineProperty(prototype, name, native);
      else delete (prototype as unknown as Record<string, unknown>)[name];
    }
    Object.defineProperty(prototype, "load", load);
    Object.defineProperty(prototype, "canPlayType", canPlayType);
    if (textTrackList && getTrackById) Object.defineProperty(textTrackList, "getTrackById", getTrackById);
  };
};
