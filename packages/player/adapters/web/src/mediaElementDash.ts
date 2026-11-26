/**
 * dash.js on the application's own `<video>` and `<audio>` (TS 102 796 §9.4.2,
 * A.2.12): an HbbTV 2 terminal presents an MPD set as the source of an HTML5 media
 * element, which no desktop browser does by itself. The page runtime decides when an
 * element presents DASH (`installMediaElementDash`); this is the engine it uses.
 *
 * dash.js writes the element's source itself (the object URL of its MediaSource, and
 * `removeAttribute("src")` + `load()` when it lets it go). The page's accessors must
 * hand those writes to the browser, not take them for the application's: dash.js
 * makes them in `VideoModel.setSource`, which the engine runs through `internally`.
 *
 * Every MPD dash.js loads (the first, and each update of a dynamic one) is handed over
 * as it came (`onManifest`), for what dash.js does not expose to the application: the
 * MPD's events (TS 102 796 §9.3.2.2).
 */

import { dashjs } from "./dashjs";

export type MediaElementDashHooks = Readonly<{
  /** Runs one of dash.js's own writes to the element's source. */
  internally: (write: () => void) => void;
  /** A fatal error of the presentation, as the `MediaError` code the browser would give. */
  onError: (code: number, message: string) => void;
  /** The text of an MPD dash.js loaded, before it reads it. */
  onManifest: (text: string) => void;
}>;

export type MediaElementDash = Readonly<{
  /** Presents the MPD at `url` (absolute), from its start; again, starts over or switches. */
  attachSource: (url: string) => void;
  /** Lets the element go, with no source; the engine is not used again. */
  reset: () => void;
}>;

export type MediaElementDashEngine = Readonly<{
  create: (element: HTMLMediaElement, hooks: MediaElementDashHooks) => MediaElementDash;
  /** `MediaSource.isTypeSupported`: whether the browser can play a codec in a segment format. */
  isTypeSupported: (type: string) => boolean;
}>;

/** `MediaError` codes (HTML), which jsdom and old engines may not define as constants. */
const MEDIA_ERR_NETWORK = 2;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

/**
 * The `MediaError` a fatal dash.js error stands for, as the browser reports a source of
 * its own: an MPD that cannot be fetched or read is a source it cannot play (as for a
 * `src` that answers 404), a segment that cannot be fetched after dash.js's retries is a
 * network error. Anything else is not reported to the element: a segment the browser
 * cannot decode fails the MediaSource, and the browser reports it itself.
 */
export const dashMediaErrorCode = (code: number): number | null => {
  const errors = dashjs.MediaPlayer.errors;
  switch (code) {
    case errors.MANIFEST_LOADER_PARSING_FAILURE_ERROR_CODE:
    case errors.MANIFEST_LOADER_LOADING_FAILURE_ERROR_CODE:
    case errors.MANIFEST_ERROR_ID_PARSE_CODE:
    case errors.MANIFEST_ERROR_ID_NOSTREAMS_CODE:
    case errors.DOWNLOAD_ERROR_ID_MANIFEST_CODE:
      return MEDIA_ERR_SRC_NOT_SUPPORTED;
    case errors.FRAGMENT_LOADER_LOADING_FAILURE_ERROR_CODE:
    case errors.DOWNLOAD_ERROR_ID_CONTENT_CODE:
    case errors.DOWNLOAD_ERROR_ID_INITIALIZATION_CODE:
      return MEDIA_ERR_NETWORK;
    default:
      return null;
  }
};

type VideoModel = { setSource: (source: string | null) => void };

/** What dash.js puts in its requests' `customData`: the request, with what it is for. */
type DashRequest = { request?: { type?: string } };

/** dash.js's `HTTPRequest.MPD_TYPE`. */
const MPD_TYPE = "MPD";

const text = (data: unknown): string | null => {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  return null;
};

/** dash.js's `MediaPlayer`, which takes the player's context although its types do not say so. */
const mediaPlayer = dashjs.MediaPlayer as unknown as (context: object) => dashjs.MediaPlayerFactory;

const create = (element: HTMLMediaElement, hooks: MediaElementDashHooks): MediaElementDash => {
  // What `player.extend("VideoModel", …, true)` writes in the player's context: given
  // before `create()`, because the player makes its VideoModel there. With `true`, the
  // extension replaces only the methods it returns, and `this.parent` is the original.
  const context = {
    VideoModel: {
      override: true,
      instance(this: { parent: VideoModel }): Partial<VideoModel> {
        const setSource = this.parent.setSource;
        return { setSource: (source) => hooks.internally(() => setSource(source)) };
      },
    },
  };
  const player = mediaPlayer(context).create();
  player.updateSettings({ debug: { logLevel: dashjs.Debug.LOG_LEVEL_WARNING } });
  player.addResponseInterceptor((response) => {
    const ok = response.status === undefined || (response.status >= 200 && response.status < 300);
    const manifest = (response.request.customData as DashRequest | undefined)?.request?.type === MPD_TYPE;
    const body = manifest && ok ? text(response.data) : null;
    if (body !== null) hooks.onManifest(body);
    return Promise.resolve(response);
  });
  player.on(dashjs.MediaPlayer.events.ERROR, (event: dashjs.MediaPlayerErrorEvent) => {
    const code = dashMediaErrorCode(event.error.code);
    if (code !== null) hooks.onError(code, event.error.message ?? "");
  });
  // No autoplay of its own: the element plays as the application asks, `autoplay` included.
  hooks.internally(() => player.initialize(element as HTMLVideoElement, undefined, false));

  return {
    attachSource: (url) => player.attachSource(url),
    reset: () => hooks.internally(() => player.reset()),
  };
};

/** The engine, or `null` where the browser has no Media Source Extensions. */
export const mediaElementDashEngine = (window: Window): MediaElementDashEngine | null => {
  const MediaSource = (window as Window & { MediaSource?: typeof globalThis.MediaSource }).MediaSource;
  if (typeof MediaSource?.isTypeSupported !== "function") return null;
  return { create, isTypeSupported: (type) => MediaSource.isTypeSupported(type) };
};
