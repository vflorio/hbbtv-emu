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
 * MPD's events (TS 102 796 §9.3.2.2). The events of the segments (`emsg` boxes of an
 * `InbandEventStream`) are handed over as dash.js receives them, for the schemes the
 * page runtime follows (`followInband`): dash.js gives them only to a listener.
 *
 * The audio and video tracks dash.js offers in the Period it presents, and which of
 * them it presents, are handed over whenever they may have changed (`onTracks`), for
 * the element's `audioTracks` and `videoTracks` (TS 102 796 A.2.12.1); `selectTrack`
 * switches to another one.
 *
 * The subtitle tracks are the element's TextTracks, which dash.js makes itself
 * (`VideoModel.addTextTrack`): the engine has the page runtime make each one
 * (`onTextTrack`), with the kind, label and language HbbTV gives it, and hands dash.js
 * a stand-in that adds its cues to it but leaves its `mode` to the application. dash.js
 * fetches the cues of one subtitle track at a time, none at first (`selectText`). Its
 * cues of TTML carry the document to render at their time (`isd`, imsc's), and render
 * nothing themselves: the engine gives dash.js no element to render into.
 */

import { dashjs } from "./dashjs";

export type MediaElementDashHooks = Readonly<{
  /** Runs one of dash.js's own writes to the element's source. */
  internally: (write: () => void) => void;
  /** A fatal error of the presentation, as the `MediaError` code the browser would give. */
  onError: (code: number, message: string) => void;
  /** The text of an MPD dash.js loaded, before it reads it. */
  onManifest: (text: string) => void;
  /** An event of the segments, of a scheme the page runtime follows, as dash.js receives it. */
  onInbandEvent: (event: InbandEvent) => void;
  /** The tracks of the Period dash.js presents: when it starts one, and when it switches tracks. */
  onTracks: (tracks: DashTracks) => void;
  /**
   * A subtitle track of the Period dash.js starts: the element's TextTrack for it, made
   * by the page runtime; `null` leaves it to dash.js. Once per track: the same kind,
   * language and id in another Period is the same TextTrack, as dash.js has it.
   */
  onTextTrack: (track: DashTextTrack) => TextTrack | null;
}>;

export type DashTrackType = "audio" | "video";

/** An audio, video or text track dash.js offers: an AdaptationSet, or a Preselection (audio). */
export type DashTrack = Readonly<{
  /** What `selectTrack` and `selectText` take: `adaptation:<index in the Period>` or `preselection:<id>`. */
  ref: string;
  /** `@id`, "" if absent. */
  id: string;
  /** As dash.js read it, normalized (BCP 47). */
  lang: string;
  /** The values of the `urn:mpeg:dash:role:2011` Roles. */
  roles: ReadonlyArray<string>;
  /** The values of the `urn:tva:metadata:cs:AudioPurposeCS:2007` Accessibility descriptors. */
  audioPurposes: ReadonlyArray<string>;
  /** Whether it has Accessibility descriptors, of any scheme. */
  accessibility: boolean;
}>;

/** A subtitle track dash.js offers, as it makes its TextTrack. */
export type DashTextTrack = DashTrack &
  Readonly<{
    /** The Period's position in the MPD. */
    period: number;
    /** TTML (EBU-TT-D), not WebVTT. */
    ttml: boolean;
    /** The audio tracks of the same Period. */
    audio: ReadonlyArray<DashTrack>;
  }>;

export type DashTracks = Readonly<{
  /** The Period's position in the MPD. */
  period: number;
  audio: ReadonlyArray<DashTrack>;
  video: ReadonlyArray<DashTrack>;
  /** The `ref` of the track dash.js presents, of each type. */
  current: Readonly<Record<DashTrackType, string | null>>;
}>;

/** An `emsg` event (ISO/IEC 23009-1 §5.10.3.3), on the element's timeline. */
export type InbandEvent = Readonly<{
  schemeIdUri: string;
  value: string;
  id: string;
  /** In seconds: from `presentation_time_delta` (version 0) or `presentation_time` (version 1). */
  startTime: number;
  /** In seconds; `null` for an indeterminate `event_duration` (0xFFFF, or 0xFFFFFFFF). */
  duration: number | null;
  /** `message_data`. */
  data: ArrayBuffer;
}>;

export type MediaElementDash = Readonly<{
  /** Presents the MPD at `url` (absolute), from its start; again, starts over or switches. */
  attachSource: (url: string) => void;
  /** Lets the element go, with no source; the engine is not used again. */
  reset: () => void;
  /** Hands over the inband events of a scheme from now on (`onInbandEvent`); again, nothing more. */
  followInband: (schemeIdUri: string) => void;
  /** Presents another track of the Period (a `ref` of `onTracks`); `false` if dash.js has none such. */
  selectTrack: (type: DashTrackType, ref: string) => boolean;
  /** Has dash.js fetch the cues of this subtitle track (a `ref` of `onTextTrack`), from now on and in the next Periods; `null`, of none. */
  selectText: (ref: string | null) => void;
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

type VideoModel = {
  setSource: (source: string | null) => void;
  addTextTrack: (...args: TextTrackArgs) => object | null;
  getTextTrack: (...args: TextTrackArgs) => object | null;
};

/** What dash.js puts in its requests' `customData`: the request, with what it is for. */
type DashRequest = { request?: { type?: string } };

/** dash.js's `HTTPRequest.MPD_TYPE`. */
const MPD_TYPE = "MPD";

/** What dash.js gives a listener of a scheme (its `Event`, in `{ event }`). */
type DashEventPayload = {
  event?: {
    id?: number | string;
    duration?: number;
    calculatedPresentationTime?: number;
    /** A number only for an inband event: NaN for an event of the MPD. */
    presentationTimeDelta?: number;
    messageData?: Uint8Array | string;
    eventStream?: { schemeIdUri?: string; value?: string; timescale?: number };
  };
};

/** `event_duration` values that mean "unknown" (TS 102 796 §9.3.2.2 writes 0xFFFF; emsg's field is 32 bits). */
const INDETERMINATE_DURATIONS = new Set([0xffff, 0xffffffff]);

const bytesOf = (data: Uint8Array | string | undefined): ArrayBuffer => {
  if (data === undefined) return new ArrayBuffer(0);
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  // A copy: dash.js can delete or reuse its own.
  return bytes.slice().buffer as ArrayBuffer;
};

/** The inband event of a payload; `null` for an event of the MPD, or one that is not whole. */
export const inbandEventOf = (payload: DashEventPayload): InbandEvent | null => {
  const event = payload.event;
  const stream = event?.eventStream;
  if (!event || !stream?.schemeIdUri || typeof event.presentationTimeDelta !== "number") return null;
  if (Number.isNaN(event.presentationTimeDelta) || typeof event.calculatedPresentationTime !== "number") return null;
  const timescale = stream.timescale || 1;
  const duration = typeof event.duration === "number" && Number.isFinite(event.duration) ? event.duration : null;
  return {
    schemeIdUri: stream.schemeIdUri,
    value: stream.value ?? "",
    id: event.id === undefined || (typeof event.id === "number" && Number.isNaN(event.id)) ? "" : String(event.id),
    startTime: event.calculatedPresentationTime,
    duration: duration === null || INDETERMINATE_DURATIONS.has(Math.round(duration * timescale)) ? null : duration,
    data: bytesOf(event.messageData),
  };
};

const ROLE_SCHEME = "urn:mpeg:dash:role:2011";
const AUDIO_PURPOSE_SCHEME = "urn:tva:metadata:cs:AudioPurposeCS:2007";

const values = (descriptors: dashjs.MediaInfo["roles"], scheme: string): string[] =>
  (descriptors ?? []).filter((descriptor) => descriptor.schemeIdUri === scheme).map((descriptor) => descriptor.value);

const refOf = (track: dashjs.MediaInfo): string =>
  track.isPreselection ? `preselection:${track.id ?? ""}` : `adaptation:${track.index ?? ""}`;

/** A track as the page runtime needs it, from what dash.js knows of it. */
export const dashTrackOf = (track: dashjs.MediaInfo): DashTrack => ({
  ref: refOf(track),
  id: track.id ?? "",
  lang: track.lang ?? "",
  roles: values(track.roles, ROLE_SCHEME),
  audioPurposes: values(track.accessibility, AUDIO_PURPOSE_SCHEME),
  accessibility: (track.accessibility ?? []).length > 0,
});

/** What dash.js gives `VideoModel.addTextTrack`, and looks a track up by (`getTextTrack`). */
type TextTrackArgs = [kind: string, label: unknown, lang: string, isTTML: boolean, isEmbedded: boolean];

/** As dash.js's `getTextTrack` compares: any label matches none. */
const sameTextTrack = (made: TextTrackArgs, [kind, label, lang, isTTML, isEmbedded]: TextTrackArgs): boolean =>
  made[0] === kind &&
  (label ? String(made[1]) === String(label) : true) &&
  made[2] === lang &&
  made[3] === isTTML &&
  made[4] === isEmbedded;

/**
 * What dash.js gets for a TextTrack of the page runtime: its cues are the track's, its
 * `mode` reads the track's and writing it does nothing (dash.js sets it when it changes
 * track, to show its own rendering). What else dash.js writes on a track stays here.
 */
export const textTrackStandIn = (track: TextTrack): object => ({
  get mode() {
    return track.mode;
  },
  set mode(_: unknown) {},
  get cues() {
    return track.cues;
  },
  get activeCues() {
    return track.activeCues;
  },
  addCue: (cue: TextTrackCue) => track.addCue(cue),
  removeCue: (cue: TextTrackCue) => track.removeCue(cue),
});

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
        const { setSource, addTextTrack, getTextTrack } = this.parent;
        return {
          setSource: (source) => hooks.internally(() => setSource(source)),
          addTextTrack: (...args) => getStandIn(args) ?? makeTextTrack(args) ?? addTextTrack(...args),
          getTextTrack: (...args) => getStandIn(args) ?? getTextTrack(...args),
        };
      },
    },
  };

  // The subtitle tracks: the page runtime's TextTracks, behind stand-ins for dash.js.
  const standIns: { args: TextTrackArgs; standIn: object }[] = [];
  const getStandIn = (args: TextTrackArgs) => standIns.find((made) => sameTextTrack(made.args, args))?.standIn ?? null;
  const makeTextTrack = (args: TextTrackArgs): object | null => {
    const [, label, lang, isTTML, isEmbedded] = args;
    if (isEmbedded) return null;
    // dash.js labels a track with its AdaptationSet's id, or its language without one;
    // it makes them as it starts their Period, when that is the active one.
    const info = tracksOf("text").find(
      (candidate) =>
        String(candidate.id !== undefined ? candidate.id : candidate.lang) === String(label) && candidate.lang === lang,
    );
    const period = info?.streamInfo?.index;
    if (!info || period === undefined || period === null) return null;
    const track = hooks.onTextTrack({
      ...dashTrackOf(info),
      period,
      ttml: Boolean(isTTML),
      audio: tracksOf("audio").map(dashTrackOf),
    });
    if (!track) return null;
    const standIn = textTrackStandIn(track);
    standIns.push({ args, standIn });
    return standIn;
  };

  const player = mediaPlayer(context).create();
  player.updateSettings({
    debug: { logLevel: dashjs.Debug.LOG_LEVEL_WARNING },
    streaming: {
      // No subtitles until the application shows a track; their cues as dash.js
      // receives them, with nothing of its own rendering.
      text: { defaultEnabled: false, dispatchForManualRendering: true },
      // Nothing of the application's choices in its storage (dash.js's "dashjs_*" keys).
      lastMediaSettingsCachingInfo: { enabled: false },
      lastBitrateCachingInfo: { enabled: false },
    },
  });
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

  const tracksOf = (type: DashTrackType | "text"): dashjs.MediaInfo[] => {
    try {
      return player.getTracksFor(type) ?? [];
    } catch {
      return [];
    }
  };
  const showTracks = () => {
    const period = player.getActiveStream()?.getStreamInfo()?.index;
    if (period === undefined || period === null) return;
    const current = (type: DashTrackType) => {
      const track = player.getCurrentTrackFor(type);
      return track ? refOf(track) : null;
    };
    hooks.onTracks({
      period,
      audio: tracksOf("audio").map(dashTrackOf),
      video: tracksOf("video").map(dashTrackOf),
      current: { audio: current("audio"), video: current("video") },
    });
  };
  for (const event of [
    dashjs.MediaPlayer.events.STREAM_INITIALIZED,
    dashjs.MediaPlayer.events.PERIOD_SWITCH_COMPLETED,
    dashjs.MediaPlayer.events.TRACK_CHANGE_RENDERED,
  ])
    player.on(event, showTracks);

  // The subtitle track the page runtime selects, by its ref, in each Period dash.js
  // starts: dash.js's index for it is its position among the Period's text tracks.
  let selectedText: string | null = null;
  const textTracksOf = new Map<string, ReadonlyArray<dashjs.MediaInfo>>();
  const applyText = () => {
    const stream = player.getActiveStream()?.getStreamInfo()?.id;
    const tracks = stream === undefined ? undefined : textTracksOf.get(stream);
    if (!tracks) return;
    const index = selectedText === null ? -1 : tracks.findIndex((track) => refOf(track) === selectedText);
    try {
      if (player.getCurrentTextTrackIndex() !== index) player.setTextTrack(index);
    } catch {
      // Before dash.js plays: the Period's tracks will come again.
    }
  };
  player.on(dashjs.MediaPlayer.events.TEXT_TRACKS_ADDED, (event: dashjs.TextTracksAddedEvent) => {
    const stream = (event as { streamId?: string }).streamId;
    if (stream === undefined) return;
    textTracksOf.set(stream, event.tracks);
    applyText();
  });

  const followed = new Set<string>();
  const onEvent = (payload: DashEventPayload) => {
    const event = inbandEventOf(payload);
    if (event) hooks.onInbandEvent(event);
  };

  return {
    attachSource: (url) => {
      // Its Periods' ids are those of the last source's again.
      textTracksOf.clear();
      player.attachSource(url);
    },
    reset: () => hooks.internally(() => player.reset()),
    followInband: (schemeIdUri) => {
      if (followed.has(schemeIdUri)) return;
      followed.add(schemeIdUri);
      player.on(schemeIdUri, onEvent as (event: unknown) => void, undefined, {
        mode: dashjs.MediaPlayer.events.EVENT_MODE_ON_RECEIVE,
      });
    },
    selectTrack: (type, ref) => {
      const track = tracksOf(type).find((candidate) => refOf(candidate) === ref);
      if (!track) return false;
      player.setCurrentTrack(track);
      return true;
    },
    selectText: (ref) => {
      selectedText = ref;
      applyText();
    },
  };
};

/** The engine, or `null` where the browser has no Media Source Extensions. */
export const mediaElementDashEngine = (window: Window): MediaElementDashEngine | null => {
  const MediaSource = (window as Window & { MediaSource?: typeof globalThis.MediaSource }).MediaSource;
  if (typeof MediaSource?.isTypeSupported !== "function") return null;
  return { create, isTypeSupported: (type) => MediaSource.isTypeSupported(type) };
};
