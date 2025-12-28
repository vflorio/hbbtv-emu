/**
 * VideoStream Events - Tagged Union (ADT)
 */

import type { VideoStreamError } from "./errors";
import type { VideoStreamPlayState } from "./state";

export type VideoStreamEvent =
  | {
      readonly _tag: "VideoStreamEvent/StateChange";
      readonly timestamp: number;
      readonly state: VideoStreamPlayState;
      readonly previousState: VideoStreamPlayState;
    }
  | {
      readonly _tag: "VideoStreamEvent/TimeUpdate";
      readonly timestamp: number;
      readonly currentTime: number;
    }
  | {
      readonly _tag: "VideoStreamEvent/DurationChange";
      readonly timestamp: number;
      readonly duration: number;
    }
  | {
      readonly _tag: "VideoStreamEvent/VolumeChange";
      readonly timestamp: number;
      readonly volume: number;
      readonly muted: boolean;
    }
  | {
      readonly _tag: "VideoStreamEvent/Error";
      readonly timestamp: number;
      readonly error: VideoStreamError;
    }
  | {
      readonly _tag: "VideoStreamEvent/Ended";
      readonly timestamp: number;
    }
  | {
      readonly _tag: "VideoStreamEvent/FullscreenChange";
      readonly timestamp: number;
      readonly fullscreen: boolean;
    };

/**
 * Event constructors
 */
export const VideoStreamEvent = {
  stateChange: (state: VideoStreamPlayState, previousState: VideoStreamPlayState): VideoStreamEvent => ({
    _tag: "VideoStreamEvent/StateChange",
    timestamp: Date.now(),
    state,
    previousState,
  }),
  timeUpdate: (currentTime: number): VideoStreamEvent => ({
    _tag: "VideoStreamEvent/TimeUpdate",
    timestamp: Date.now(),
    currentTime,
  }),
  durationChange: (duration: number): VideoStreamEvent => ({
    _tag: "VideoStreamEvent/DurationChange",
    timestamp: Date.now(),
    duration,
  }),
  volumeChange: (volume: number, muted: boolean): VideoStreamEvent => ({
    _tag: "VideoStreamEvent/VolumeChange",
    timestamp: Date.now(),
    volume,
    muted,
  }),
  error: (error: VideoStreamError): VideoStreamEvent => ({
    _tag: "VideoStreamEvent/Error",
    timestamp: Date.now(),
    error,
  }),
  ended: (): VideoStreamEvent => ({
    _tag: "VideoStreamEvent/Ended",
    timestamp: Date.now(),
  }),
  fullscreenChange: (fullscreen: boolean): VideoStreamEvent => ({
    _tag: "VideoStreamEvent/FullscreenChange",
    timestamp: Date.now(),
    fullscreen,
  }),
} as const;

/**
 * Type guards for VideoStreamEvent
 */
export const isStateChangeEvent = (
  event: VideoStreamEvent,
): event is VideoStreamEvent & {
  _tag: "VideoStreamEvent/StateChange";
  timestamp: number;
  state: VideoStreamPlayState;
  previousState: VideoStreamPlayState;
} => event._tag === "VideoStreamEvent/StateChange";

export const isTimeUpdateEvent = (
  event: VideoStreamEvent,
): event is VideoStreamEvent & { _tag: "VideoStreamEvent/TimeUpdate"; timestamp: number; currentTime: number } =>
  event._tag === "VideoStreamEvent/TimeUpdate";

export const isDurationChangeEvent = (
  event: VideoStreamEvent,
): event is VideoStreamEvent & { _tag: "VideoStreamEvent/DurationChange"; timestamp: number; duration: number } =>
  event._tag === "VideoStreamEvent/DurationChange";

export const isVolumeChangeEvent = (
  event: VideoStreamEvent,
): event is VideoStreamEvent & {
  _tag: "VideoStreamEvent/VolumeChange";
  timestamp: number;
  volume: number;
  muted: boolean;
} => event._tag === "VideoStreamEvent/VolumeChange";

export const isErrorEvent = (
  event: VideoStreamEvent,
): event is VideoStreamEvent & { _tag: "VideoStreamEvent/Error"; timestamp: number; error: VideoStreamError } =>
  event._tag === "VideoStreamEvent/Error";

export const isEndedEvent = (
  event: VideoStreamEvent,
): event is VideoStreamEvent & { _tag: "VideoStreamEvent/Ended"; timestamp: number } =>
  event._tag === "VideoStreamEvent/Ended";

export const isFullscreenChangeEvent = (
  event: VideoStreamEvent,
): event is VideoStreamEvent & { _tag: "VideoStreamEvent/FullscreenChange"; timestamp: number; fullscreen: boolean } =>
  event._tag === "VideoStreamEvent/FullscreenChange";

/**
 * Event listener callback
 */
export type VideoStreamEventListener = (event: VideoStreamEvent) => void;
