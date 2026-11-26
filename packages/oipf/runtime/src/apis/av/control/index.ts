/**
 * A/V Control object, video (OIPF DAE §7.14)
 *
 * Composed from Reader parts (ROADMAP D1), as video/broadcast:
 * - `playback` (§7.14.1, §7.14.3.1): `data`, play states, `play()`, `stop()`, `seek()`…;
 * - `volume`: `setVolume()`, with the same rules as video/broadcast's;
 * - `display`: `fullScreen`, `setFullScreen()`, `onFullScreenChange`. `width` and
 *   `height` stay the `<object>`'s own (the legacy `visual` attach does not take them
 *   over), so only the settings UI sizes the window through this part;
 * - components: kept for the settings UI only, no OIPF methods yet.
 *
 * `focus()` focuses the `<object>`: its `onfocus`/`onblur` are the element's own
 * handlers, which the browser calls.
 */

import { createLogger, createStatefulMethods, type Stateful } from "@hbb-emu/core";
import type { AVControlState, OIPF } from "@hbb-emu/oipf-api";
import type * as IO from "fp-ts/IO";
import { combine, readOnly, stateSchema } from "../../compose";
import { applyComponentState, createComponentEnv, readComponentState } from "../../dae/videoBroadcast/component";
import {
  applyDisplayState,
  createDisplayEnv,
  isFullScreen,
  readDisplayState,
  setFullScreen,
  type VideoWindow,
} from "../../dae/videoBroadcast/display";
import {
  type AudioOutput,
  applyVolumeState,
  createVolumeEnv,
  DEFAULT_VOLUME_STATE,
  readVolumeState,
  setVolume,
  type VolumeState,
} from "../../dae/videoBroadcast/volume";
import {
  applyPlaybackState,
  createPlaybackEnv,
  getPlayPosition,
  getPlayTime,
  play,
  readPlaybackState,
  seek,
  setData,
  startPlayback,
  stop,
} from "./playback";
import type { AvStream } from "./stream";

const logger = createLogger("AVControl");

type AVControlVideoSpec = OIPF.AV.Control.AVControlVideo;

export type AVControlVideoEventHandlers = Readonly<{
  onPlayStateChange: (state: OIPF.AV.Control.PlayState) => void;
  onPlayPositionChanged: (position: number | undefined) => void;
  onPlaySpeedChanged: (speed: number) => void;
  onFullScreenChange: (fullScreen: boolean) => void;
}>;

export type AVControlVideoDefaults = Readonly<{
  fullScreen: boolean;
  volume: VolumeState;
}>;

export const DEFAULT_AV_CONTROL_VIDEO_DEFAULTS: AVControlVideoDefaults = {
  fullScreen: false,
  volume: DEFAULT_VOLUME_STATE,
};

export type AVControlVideoDependencies = Readonly<{
  /** The object's `type`. */
  mimeType: IO.IO<string>;
  stream: AvStream;
  /** Where the object's audio goes: in series with the TV's volume (`audioInSeries`). */
  audioOutput: AudioOutput;
  videoWindow: VideoWindow;
  /** Gives the `<object>` the input focus. */
  focusObject: IO.IO<void>;
  defaults: AVControlVideoDefaults;
  eventHandlers: AVControlVideoEventHandlers;
}>;

/** Handlers the application sets on the element itself, and the element's own size. */
type ElementKeys =
  | "onPlayStateChange"
  | "onPlayPositionChanged"
  | "onPlaySpeedChanged"
  | "onFullScreenChange"
  | "onfocus"
  | "onblur"
  | "width"
  | "height";

export type AVControlVideoApi = Omit<AVControlVideoSpec, ElementKeys>;

export type AVControlVideo = AVControlVideoApi &
  Stateful<AVControlState> &
  Readonly<{
    /** The video the object presents. */
    videoElement: HTMLVideoElement;
  }>;

export const createAVControlVideo = (dependencies: AVControlVideoDependencies): AVControlVideo => {
  const { stream, eventHandlers, defaults } = dependencies;

  const playback = createPlaybackEnv({
    player: stream,
    playbackEvents: {
      onPlayStateChange: (playState) => () => eventHandlers.onPlayStateChange(playState),
      onPlaySpeedChanged: (speed) => () => eventHandlers.onPlaySpeedChanged(speed),
      onPlayPositionChanged: (position) => () => eventHandlers.onPlayPositionChanged(position),
    },
  })();
  const display = createDisplayEnv(
    dependencies.videoWindow,
    { onFullScreenChange: (fullScreen) => () => eventHandlers.onFullScreenChange(fullScreen) },
    defaults.fullScreen,
  )();
  const volume = createVolumeEnv(dependencies.audioOutput, defaults.volume)();
  const component = createComponentEnv();

  const object: AVControlVideoApi = {
    get data() {
      return readPlaybackState(playback)().data;
    },
    set data(url: string) {
      setData(String(url ?? ""))(playback)();
    },
    get playPosition() {
      return getPlayPosition(playback)();
    },
    get playTime() {
      return getPlayTime(playback)();
    },
    get playState() {
      return readPlaybackState(playback)().playState;
    },
    get error() {
      return readPlaybackState(playback)().error;
    },
    get speed() {
      return readPlaybackState(playback)().speed;
    },
    play: (speed = 1) => play(speed)(playback)(),
    stop: () => stop(playback)(),
    seek: (position) => seek(position)(playback)(),
    setVolume: (level) => setVolume(level)(volume)(),
    queue: (url) => {
      logger.debug("queue: not implemented", url)();
      return false;
    },
    setSource: (id) => {
      logger.debug("setSource: not implemented", id)();
      return false;
    },
    get fullScreen() {
      return isFullScreen(display)();
    },
    setFullScreen: (fullScreen) => setFullScreen(fullScreen)(display)(),
    focus: () => dependencies.focusObject(),
  };

  type PlaybackPatch = Parameters<typeof applyPlaybackState>[0];
  const stateful = createStatefulMethods<AVControlState, AVControlVideoApi>(
    stateSchema<AVControlState, AVControlVideoApi>({
      mimeType: readOnly(dependencies.mimeType),
      data: {
        read: () => readPlaybackState(playback)().data,
        apply: (data: string) => applyPlaybackState({ data })(playback),
      },
      playState: {
        read: () => readPlaybackState(playback)().playState,
        apply: (playState: PlaybackPatch["playState"]) => applyPlaybackState({ playState })(playback),
      },
      error: {
        read: () => readPlaybackState(playback)().error,
        apply: (error: PlaybackPatch["error"]) => applyPlaybackState({ error })(playback),
      },
      speed: {
        read: () => readPlaybackState(playback)().speed,
        apply: (speed: number) => applyPlaybackState({ speed })(playback),
      },
      playPosition: {
        read: getPlayPosition(playback),
        apply: (position: number) => () => {
          seek(position)(playback)();
        },
      },
      playTime: readOnly(getPlayTime(playback)),
      volume: {
        read: () => readVolumeState(volume)().volume,
        apply: (level: number) => applyVolumeState({ volume: level })(volume),
      },
      muted: {
        read: () => readVolumeState(volume)().muted,
        apply: (muted: boolean) => applyVolumeState({ muted })(volume),
      },
      fullScreen: {
        read: () => readDisplayState(display)().fullScreen,
        apply: (fullScreen: boolean) => applyDisplayState({ fullScreen })(display),
      },
      width: {
        read: () => readDisplayState(display)().width,
        apply: (width: number) => applyDisplayState({ width })(display),
      },
      height: {
        read: () => readDisplayState(display)().height,
        apply: (height: number) => applyDisplayState({ height })(display),
      },
      components: {
        read: () => [...readComponentState(component)().components],
        apply: (components: ReadonlyArray<unknown>) => applyComponentState({ components })(component),
      },
      selectedComponents: {
        read: () => ({ ...readComponentState(component)().selectedComponents }),
        apply: (selectedComponents: Record<string, unknown>) => applyComponentState({ selectedComponents })(component),
      },
    }),
    object,
  );

  const avControl: AVControlVideo = combine(object, {
    videoElement: stream.videoElement,
    applyState: stateful.applyState,
    getState: stateful.getState,
    subscribe: stateful.subscribe,
    notifyStateChange: stateful.notifyStateChange,
  });

  startPlayback(playback)();
  return avControl;
};
