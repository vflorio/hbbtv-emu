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
 *   stream with a finite duration loops from the channel's epoch: when it first presents,
 *   it seeks to where the loop is on air now, as part of its start-up. A live stream (no
 *   finite duration) follows the real time on its own.
 */

import { createLogger, livePosition } from "@hbb-emu/core";
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
  /** Seeks to a position, in seconds. */
  seek: (seconds: number) => IO.IO<void>;
  setMuted: (muted: boolean) => IO.IO<void>;
  /** Subscribes to the stream's state; returns the unsubscribe function. */
  onStateChange: (listener: (state: VideoStreamPlayState) => void) => () => void;
}>;

/** The stream on the page's player (the web player's adapters: native, HLS, DASH). */
export const createBroadcastStream = (playerRuntime?: PlayerRuntime): BroadcastStream => {
  const stream = new VideoStreamService(undefined, playerRuntime);
  // The OIPF methods are synchronous: the player's tasks run on their own.
  const run = (task: () => Promise<unknown>) => () => {
    void task();
  };
  return {
    videoElement: stream.videoElement,
    load: (url) => run(stream.loadSource({ url, loop: true, autoPlay: true, muted: true })),
    play: run(stream.play()),
    stop: run(stream.stop()),
    seek: (seconds) => run(stream.seek(seconds * 1000)),
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

/** How far from the channel's position a stream may start without seeking, in seconds. */
const LIVE_TOLERANCE_S = 1;

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
  /** Whether the stream loaded has joined the channel where it is on air. */
  let joined = false;
  let stopped = false;
  let streamState: VideoStreamPlayState = { _tag: "Idle" };
  let controller: Controller | null = null;
  let observers: ReadonlyArray<MutationObserver> = [];
  let observedBody: HTMLElement | null = null;
  let backgroundCheck: number | null = null;

  const load = (url: string) => {
    logger.debug("Loading", url)();
    loaded = url;
    presented = false;
    joined = false;
    stopped = false;
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

  /**
   * On its first frame, a looping stream joins the channel where it is on air: it seeks
   * there, and its start-up goes on until the seek presents. Whether it seeks.
   */
  const joinLive = (): boolean => {
    if (joined) return false;
    joined = true;
    const position = livePosition(now(), video.duration);
    if (position === null || Math.abs(position - video.currentTime) < LIVE_TOLERANCE_S) return false;
    logger.debug("Joining the channel on air at", position)();
    stream.seek(position)();
    return true;
  };

  stream.onStateChange((state) => {
    streamState = state;
    if (!presented && hasPresented(state) && joinLive()) return;
    const startUp = !presented && isStartUp(state);
    if (hasPresented(state)) presented = true;
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
