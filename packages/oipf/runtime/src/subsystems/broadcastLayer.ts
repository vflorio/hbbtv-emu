/**
 * The broadcast the TV presents in the page (OIPF DAE Annex H, TS 102 796 §6.2.2.3)
 *
 * A TV has one broadcast presentation, whether an application is running or not. The
 * emulator's is one stream and one `<video>` per page, owned by the runtime rather than
 * by an object. The page starts it on the channel the TV is tuned to, before the
 * application's first script.
 *
 * Who presents it (Annex H.2):
 * - the TV, while no video/broadcast object is out of the unrealized state. The video
 *   fills the logical video plane, behind the application (H.1): a fixed layer over the
 *   whole viewport, under everything the page draws. The layer is black, like the
 *   background colour plane, where no video is shown;
 * - the application, while one of its video/broadcast objects is not unrealized. The
 *   same `<video>` moves inside that object, whose window it then fills
 *   (`provider/detection/embedded.ts`). When the object is released, the video moves
 *   back behind the application and keeps playing (§6.2.2.3: "shall continue without
 *   interruption").
 *
 * Choices of the emulator:
 * - one object controls the broadcast at a time: the last one that presented it or bound
 *   to it. Only that object hears the stream;
 * - an object takes control of what the TV presents as it is. Before a new stream
 *   presents for the first time, its start-up states (connecting, buffering) are not
 *   transient errors: on a TV the broadcast was already presenting, and the start-up is
 *   the emulator's own delay;
 * - the application's page background hides the video plane where it paints (H.1: the
 *   application graphic plane is above it). The layer sits above the canvas, which the
 *   root's or the body's background paints. If either paints, the layer is not shown;
 * - while the controlling object is not in the document, or is stopped, no video is
 *   shown. The stream stays in the document, so the browser does not pause it;
 * - the broadcast is on air before the page loads (a simulated live, `channelClock`). A
 *   stream with a finite duration loops from the channel's epoch: once its metadata is
 *   loaded, before its first frame, its video goes to where the loop is on air now. That is
 *   part of its start-up, which lasts until the stream is there (or `JOIN_TIMEOUT_MS` has
 *   gone by). A live stream (no finite duration) follows the real time on its own;
 * - the start-up settles for `SETTLE_MS` after the first frame: a buffering then (a stream
 *   sent ahead of what it has downloaded stalls a moment) is not heard, nor is the
 *   presentation that ends it;
 * - the loop going round (the element seeks back to its start) is no event of the
 *   broadcast either: the object does not hear the buffering it may cause;
 * - a file the emulator ships (`hbbtv-emu:`, the default test card) has its URL from the
 *   host. A page that starts before it (no bootstrap) is on air all the same: an object
 *   binds to it, and the stream loads once the host's session gives its URL.
 */

import { createLogger, isEmulatorAsset, livePosition } from "@hbb-emu/core";
import type { PlayerRuntime } from "@hbb-emu/player-runtime";
import type * as IO from "fp-ts/IO";
import { EMBEDDED_STYLES, EMBEDDED_VIDEO_ATTRIBUTE, ensureEmbeddedStyles } from "./provider/detection/embedded";
import { type TvVolume, tvGain } from "./tvVolume";
import { isStateChangeEvent, type VideoStreamPlayState, VideoStreamService } from "./videoStream";

const logger = createLogger("BroadcastLayer");

// ─────────────────────────────────────────────────────────────────────────────
// The stream
// ─────────────────────────────────────────────────────────────────────────────

/** The broadcast's stream: what the layer drives. */
export type BroadcastStream = Readonly<{
  videoElement: HTMLVideoElement;
  /** Loads a channel's stream and plays it: looping, muted (autoplay needs no gesture so). */
  load: (url: string) => IO.IO<void>;
  play: IO.IO<void>;
  stop: IO.IO<void>;
  setMuted: (muted: boolean) => IO.IO<void>;
  /** Subscribes to the stream's state; returns the unsubscribe function. */
  onStateChange: (listener: (state: VideoStreamPlayState) => void) => () => void;
}>;

/** A file an extension serves (`chrome-extension://`, `moz-extension://`): the emulator's own, such as the test card. */
const isExtensionFile = (url: string): boolean => /^(chrome|moz)-extension:/.test(url);

export type SourceLoaderEnv = Readonly<{
  /** Loads a URL into the player. */
  loadUrl: (url: string) => void;
  fetchBlob: (url: string) => Promise<Blob>;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
}>;

/**
 * Loads the broadcast's sources. A file the extension ships is read whole first, and
 * presented from memory: Firefox serves `moz-extension://` files without byte ranges,
 * reads ahead only a few seconds of them, and cannot seek past what it has, which the
 * live simulation needs to do. If it cannot be read, its URL is loaded as it is. The
 * last load wins over one still reading.
 */
export const createSourceLoader = ({ loadUrl, fetchBlob, createObjectURL, revokeObjectURL }: SourceLoaderEnv) => {
  let loads = 0;
  let objectUrl: string | null = null;
  const release = () => {
    if (objectUrl !== null) revokeObjectURL(objectUrl);
    objectUrl = null;
  };
  return (url: string): void => {
    const load = ++loads;
    if (!isExtensionFile(url)) {
      loadUrl(url);
      release();
      return;
    }
    fetchBlob(url).then(
      (blob) => {
        if (load !== loads) return;
        const previous = objectUrl;
        objectUrl = createObjectURL(blob);
        loadUrl(objectUrl);
        if (previous !== null) revokeObjectURL(previous);
      },
      (error: unknown) => {
        if (load !== loads) return;
        logger.warn("Cannot read the file whole, loading it as it is:", url, error)();
        loadUrl(url);
        release();
      },
    );
  };
};

/** The stream on the page's player (the web player's adapters: native, HLS, DASH). */
export const createBroadcastStream = (playerRuntime?: PlayerRuntime): BroadcastStream => {
  const stream = new VideoStreamService(undefined, playerRuntime);
  // The OIPF methods are synchronous: the player's tasks run on their own.
  const run = (task: () => Promise<unknown>) => () => {
    void task();
  };
  const loadSource = createSourceLoader({
    loadUrl: (url) => run(stream.loadSource({ url, loop: true, autoPlay: true, muted: true }))(),
    fetchBlob: async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    },
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  });
  return {
    videoElement: stream.videoElement,
    load: (url) => () => loadSource(url),
    play: run(stream.play()),
    stop: run(stream.stop()),
    setMuted: (muted) => run(stream.setMuted(muted)),
    onStateChange: (listener) =>
      stream.subscribe((event) => {
        if (isStateChangeEvent(event)) listener(event.state);
      })(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// The page background
// ─────────────────────────────────────────────────────────────────────────────

type Background = Pick<CSSStyleDeclaration, "backgroundColor" | "backgroundImage">;

/**
 * The alpha of a computed colour: `transparent` and `rgba(…, 0)` are 0, `rgb(…)` and other
 * colours are 1. Nothing computed (`""`) is transparent, the initial value.
 */
export const alphaOf = (color: string): number => {
  const value = color.trim();
  if (value === "" || value === "transparent") return 0;
  const channels = /rgba?\(([^)]*)\)/
    .exec(value)?.[1]
    ?.split(/[\s,/]+/)
    .filter(Boolean);
  if (!channels || channels.length < 4) return 1;
  const alpha = Number.parseFloat(channels[3] as string);
  return Number.isFinite(alpha) ? alpha : 1;
};

const paints = (background: Background): boolean =>
  !["", "none"].includes(background.backgroundImage.trim()) || alphaOf(background.backgroundColor) > 0;

/**
 * Whether the page's background hides the video plane. The root's background is the
 * canvas's; without one the body's is (CSS 2.1 §14.2). Either covers the whole plane.
 */
export const coversVideoPlane = (root: Background, body: Background | null): boolean =>
  paints(root) || (body !== null && paints(body));

// ─────────────────────────────────────────────────────────────────────────────
// The layer
// ─────────────────────────────────────────────────────────────────────────────

/** Marks the layer's element, a child of the document's root element. */
export const BROADCAST_LAYER_ATTRIBUTE = "data-hbbtv-emu-broadcast";

/** Below everything the page draws, above the canvas. */
const LAYER_STYLE: ReadonlyArray<readonly [string, string]> = [
  ["display", "block"],
  ["position", "fixed"],
  ["left", "0"],
  ["top", "0"],
  ["right", "0"],
  ["bottom", "0"],
  ["margin", "0"],
  ["padding", "0"],
  ["border", "0"],
  ["z-index", "-2147483648"],
  ["background", "#000"],
  ["pointer-events", "none"],
];

/** What a video/broadcast object does with the broadcast (`apis/dae/videoBroadcast/channel.ts`). */
export type BroadcastControl = Readonly<{
  /** Takes control and presents `url`: loads it, unless it is already what the broadcast presents. */
  present: (url: string) => IO.IO<void>;
  /** Takes control of what the TV presents, as it presents it. `false` if it presents nothing. */
  bind: IO.IO<boolean>;
  /** Stops the broadcast, if the object controls it. */
  stop: IO.IO<void>;
  /** Gives control back to the TV, which goes on presenting its channel. */
  release: IO.IO<void>;
  /** The object's own volume, in series with the TV's while it controls the broadcast. */
  setVolume: (volume: number) => IO.IO<void>;
  setMuted: (muted: boolean) => IO.IO<void>;
  /** Subscribes to the stream's state, heard while the object controls it; returns the unsubscribe function. */
  onStreamStateChange: (listener: (state: VideoStreamPlayState) => void) => () => void;
}>;

export type BroadcastLayer = Readonly<{
  videoElement: HTMLVideoElement;
  /** Puts the layer in the document, and follows the page. */
  mount: IO.IO<void>;
  unmount: IO.IO<void>;
  /** The TV is tuned to the channel whose stream is `url` (`null`: none). */
  tune: (url: string | null) => IO.IO<void>;
  /** The broadcast as a video/broadcast object controls it. */
  control: (object: HTMLObjectElement) => BroadcastControl;
}>;

export type BroadcastLayerEnv = Readonly<{
  document: Document;
  stream: BroadcastStream;
  tvVolume: TvVolume;
  /** The amplitude factor of an object's volume (video/broadcast: `broadcastGain`). */
  gain: (volume: number) => number;
  /** The real time, in ms since the Unix epoch: the channel's clock follows it. */
  now: IO.IO<number>;
}>;

type Controller = {
  readonly object: HTMLObjectElement;
  readonly listeners: Set<(state: VideoStreamPlayState) => void>;
  volume: number;
};

const isStartUp = (state: VideoStreamPlayState): boolean =>
  state._tag === "Idle" || state._tag === "Connecting" || state._tag === "Buffering";

const hasPresented = (state: VideoStreamPlayState): boolean => state._tag === "Playing" || state._tag === "Paused";

/** How far from the channel's position a stream may present without seeking, in seconds. */
const SEEK_THRESHOLD_S = 0.25;

/** How far from it a stream may be once sent there (the seek takes its time), in seconds. */
const LANDED_TOLERANCE_S = 1;

/** How long a stream's start-up waits for its seek to the channel's position, in ms. */
const JOIN_TIMEOUT_MS = 5000;

type Join =
  | { readonly _tag: "Unchecked" }
  | { readonly _tag: "OnAir" }
  | { readonly _tag: "Waiting"; readonly since: number }
  | { readonly _tag: "Sent"; readonly since: number };

/** How long the start-up settles after the first frame, in ms. */
const SETTLE_MS = 1000;

export const createBroadcastLayer = ({ document, stream, tvVolume, gain, now }: BroadcastLayerEnv): BroadcastLayer => {
  const video = stream.videoElement;
  video.setAttribute(EMBEDDED_VIDEO_ATTRIBUTE, "");

  const host = document.createElement("hbbtv-emu-broadcast");
  host.setAttribute(BROADCAST_LAYER_ATTRIBUTE, "");
  for (const [property, value] of LAYER_STYLE) host.style.setProperty(property, value, "important");
  // Out of the application's queries where the engine has Shadow DOM (`querySelector("video")`).
  const slot: Element | ShadowRoot =
    typeof host.attachShadow === "function" ? host.attachShadow({ mode: "open" }) : host;
  if (slot !== host) {
    const style = document.createElement("style");
    style.textContent = EMBEDDED_STYLES;
    slot.appendChild(style);
  }
  slot.appendChild(video);

  /** The stream the TV is tuned to. */
  let tuned: string | null = null;
  /** The stream loaded, and whether it presented since. */
  let loaded: string | null = null;
  let presented = false;
  /**
   * The stream loaded joining the channel where it is on air: not looked at yet, there
   * already (or live), waiting for its position to be seekable, or sent there.
   */
  let join: Join = { _tag: "Unchecked" };
  /** When the stream loaded first presented (`null`: not yet). */
  let presentedAt: number | null = null;
  /** The loop is going round: what the element does meanwhile is not the broadcast's. */
  let wrapping = false;
  /** A buffering the object did not hear: nor does it hear the presentation that ends it. */
  let unheardBuffering = false;
  let stopped = false;
  /**
   * A load was asked and the element has not started it yet (`loadstart`): what the stream
   * reports meanwhile is the previous source's. A stop is a pause and a seek, which the
   * player reports after the load that follows it (`stop()` then `release()`): that pause,
   * with the old source still where the channel is on air, is no presentation of the new one.
   */
  let awaitingSource = false;
  let streamState: VideoStreamPlayState = { _tag: "Idle" };
  let controller: Controller | null = null;
  let observers: ReadonlyArray<MutationObserver> = [];
  let observedBody: HTMLElement | null = null;
  let backgroundCheck: number | null = null;

  const load = (url: string) => {
    const playing = loaded !== null && !isEmulatorAsset(loaded);
    loaded = url;
    presented = false;
    join = { _tag: "Unchecked" };
    presentedAt = null;
    wrapping = false;
    unheardBuffering = false;
    stopped = false;
    if (isEmulatorAsset(url)) {
      logger.debug("On air, until the host says where it is:", url)();
      if (playing) stream.stop();
      return;
    }
    logger.debug("Loading", url)();
    awaitingSource = true;
    stream.load(url)();
  };

  const outputVolume = () => {
    video.volume = Math.min(1, tvGain(tvVolume.get()) * (controller ? gain(controller.volume) : 1));
  };

  const shown = (): boolean => !stopped && (controller === null || controller.object.isConnected);

  /** The video goes where its presenter shows it, and plays on if moving it paused it. */
  const relocate = () => {
    const root = document.documentElement;
    if (root && !host.isConnected) root.appendChild(host);
    const target = controller?.object.isConnected ? controller.object : slot;
    if (video.parentNode !== target) target.appendChild(video);
    video.style.visibility = shown() ? "" : "hidden";
    if (loaded !== null && presented && !stopped && video.paused && video.isConnected) stream.play();
  };

  const checkBackground = () => {
    backgroundCheck = null;
    const view = document.defaultView;
    const root = document.documentElement;
    if (!view || !root) return;
    const body = document.body;
    const covered = coversVideoPlane(view.getComputedStyle(root), body ? view.getComputedStyle(body) : null);
    host.style.setProperty("display", covered ? "none" : "block", "important");
  };

  /** Once per frame at most: reading the computed style makes the browser compute it. */
  const scheduleBackgroundCheck = () => {
    const view = document.defaultView;
    if (backgroundCheck !== null || !view) return;
    backgroundCheck =
      typeof view.requestAnimationFrame === "function"
        ? view.requestAnimationFrame(checkBackground)
        : view.setTimeout(checkBackground, 16);
  };

  const cancelBackgroundCheck = () => {
    const view = document.defaultView;
    if (backgroundCheck === null || !view) return;
    if (typeof view.cancelAnimationFrame === "function") view.cancelAnimationFrame(backgroundCheck);
    view.clearTimeout(backgroundCheck);
    backgroundCheck = null;
  };

  const observeBody = (attributes: MutationObserver) => {
    if (!document.body || document.body === observedBody) return;
    observedBody = document.body;
    attributes.observe(observedBody, { attributes: true, attributeFilter: ["class", "style"] });
  };

  /** Whether the stream is within `tolerance` seconds of where the loop is on air (`position`). */
  const near = (position: number, tolerance: number): boolean => {
    const drift = Math.abs(position - video.currentTime);
    // Round the loop: just before its end is near its start.
    return !video.seeking && Math.min(drift, video.duration - drift) < tolerance;
  };

  /** Whether the element can seek to `position` now (a server without byte ranges: what it has). */
  const seekable = (position: number): boolean => {
    for (let i = 0; i < video.seekable.length; i++) {
      if (video.seekable.start(i) <= position && position <= video.seekable.end(i)) return true;
    }
    return false;
  };

  /**
   * Sends the loaded stream where the channel is on air, once, if it is not there, as soon
   * as it can seek there: before that, a browser stops the seek where it can (Firefox, on a
   * `moz-extension://` file, which it gets without byte ranges). On the element itself,
   * which is the layer's: the player hears a seek, as of any other.
   */
  const advanceJoin = () => {
    if (loaded === null || isEmulatorAsset(loaded) || stopped || presented) return;
    const position = livePosition(now(), video.duration);
    if (join._tag === "Unchecked") {
      if (position === null) return;
      join = near(position, SEEK_THRESHOLD_S) ? { _tag: "OnAir" } : { _tag: "Waiting", since: now() };
    }
    if (join._tag === "Waiting" && position !== null && seekable(position)) {
      logger.debug("Joining the channel on air at", position)();
      join = { _tag: "Sent", since: join.since };
      video.currentTime = position;
    }
  };

  /**
   * Whether a stream that presents is still joining the channel where it is on air: its
   * start-up goes on until it is there (or `JOIN_TIMEOUT_MS` has gone by), whatever the
   * player reports in between.
   */
  const joining = (): boolean => {
    advanceJoin();
    if (join._tag === "Unchecked" || join._tag === "OnAir") return false;
    const position = livePosition(now(), video.duration);
    const there = join._tag === "Sent" && position !== null && near(position, LANDED_TOLERANCE_S);
    return !there && now() - join.since < JOIN_TIMEOUT_MS;
  };

  video.addEventListener("loadstart", () => {
    awaitingSource = false;
  });
  video.addEventListener("loadedmetadata", advanceJoin);
  // What the element can seek to grows as it downloads.
  video.addEventListener("progress", advanceJoin);
  video.addEventListener("canplaythrough", advanceJoin);
  // Once presented, nothing but the loop seeks the broadcast's video.
  video.addEventListener("seeking", () => {
    if (presented) wrapping = true;
  });

  stream.onStateChange((state) => {
    if (awaitingSource && hasPresented(state)) return;
    streamState = state;
    if (!presented && hasPresented(state) && joining()) return;
    // Settling, or round the loop, the stream presents as it did: the object hears none of it.
    const settling = presentedAt !== null && now() - presentedAt < SETTLE_MS;
    if (presented && state._tag === "Buffering" && (settling || wrapping)) {
      unheardBuffering = true;
      return;
    }
    if (presented && hasPresented(state) && (unheardBuffering || wrapping)) {
      unheardBuffering = false;
      wrapping = false;
      return;
    }
    const startUp = !presented && isStartUp(state);
    if (hasPresented(state) && !presented) {
      presented = true;
      presentedAt = now();
    }
    // Stopped, what the stream does is the stop's own (a pause): the object is stopped already.
    if (startUp || stopped) return;
    for (const listener of controller ? [...controller.listeners] : []) listener(state);
  });

  tvVolume.subscribe(() => () => outputVolume())();
  outputVolume();

  const takeControl = (next: Controller) => {
    if (controller === next) return;
    controller = next;
    outputVolume();
  };

  const mount: IO.IO<void> = () => {
    if (observers.length > 0) return;
    // Without Shadow DOM, the video in the layer is styled by the document's stylesheet.
    if (slot === host) ensureEmbeddedStyles(document)();
    const attributes = new MutationObserver(scheduleBackgroundCheck);
    const tree = new MutationObserver(() => {
      relocate();
      observeBody(attributes);
      scheduleBackgroundCheck();
    });
    const root = document.documentElement;
    if (root) {
      tree.observe(root, { childList: true, subtree: true });
      attributes.observe(root, { attributes: true, attributeFilter: ["class", "style"] });
    }
    observers = [tree, attributes];
    observeBody(attributes);
    // Stylesheets apply once loaded; `load` does not bubble, but it is captured.
    document.addEventListener("load", scheduleBackgroundCheck, true);
    document.addEventListener("DOMContentLoaded", scheduleBackgroundCheck);
    relocate();
    scheduleBackgroundCheck();
  };

  const unmount: IO.IO<void> = () => {
    for (const observer of observers) observer.disconnect();
    observers = [];
    observedBody = null;
    document.removeEventListener("load", scheduleBackgroundCheck, true);
    document.removeEventListener("DOMContentLoaded", scheduleBackgroundCheck);
    cancelBackgroundCheck();
    host.remove();
  };

  const tune =
    (url: string | null): IO.IO<void> =>
    () => {
      tuned = url;
      if (url === null) {
        if (loaded !== null) stream.stop();
        loaded = null;
      } else if (url !== loaded || stopped) {
        load(url);
      }
      relocate();
    };

  const control = (object: HTMLObjectElement): BroadcastControl => {
    const self: Controller = { object, listeners: new Set(), volume: 100 };
    const controls = () => controller === self;
    return {
      present: (url) => () => {
        takeControl(self);
        // One tuner: what the object presents is what the TV is on.
        tuned = url;
        if (url !== loaded || stopped || streamState._tag === "Error") load(url);
        else if (presented) for (const listener of [...self.listeners]) listener(streamState);
        relocate();
      },
      bind: () => {
        if (loaded === null || stopped) return false;
        takeControl(self);
        relocate();
        return true;
      },
      stop: () => {
        if (!controls()) return;
        stopped = true;
        stream.stop();
        relocate();
      },
      release: () => {
        if (!controls()) return;
        controller = null;
        outputVolume();
        if (tuned !== null && (tuned !== loaded || stopped || streamState._tag === "Error")) load(tuned);
        relocate();
      },
      setVolume: (volume) => () => {
        self.volume = volume;
        if (controls()) outputVolume();
      },
      setMuted: stream.setMuted,
      onStreamStateChange: (listener) => {
        self.listeners.add(listener);
        return () => {
          self.listeners.delete(listener);
        };
      },
    };
  };

  return { videoElement: video, mount, unmount, tune, control };
};
