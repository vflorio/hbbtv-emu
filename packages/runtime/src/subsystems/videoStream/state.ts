/**
 * VideoStream Play State - Tagged Union (ADT)
 * Maps to HbbTV/OIPF play states
 */

import type { VideoStreamError } from "./errors";

export type VideoStreamPlayState =
  | { readonly _tag: "Idle" }
  | { readonly _tag: "Connecting" }
  | { readonly _tag: "Buffering" }
  | { readonly _tag: "Playing" }
  | { readonly _tag: "Paused" }
  | { readonly _tag: "Finished" }
  | { readonly _tag: "Stopped" }
  | { readonly _tag: "Error"; readonly error: VideoStreamError };

/**
 * Play state constructors
 */
export const VideoStreamPlayState = {
  idle: (): VideoStreamPlayState => ({ _tag: "Idle" }),
  connecting: (): VideoStreamPlayState => ({ _tag: "Connecting" }),
  buffering: (): VideoStreamPlayState => ({ _tag: "Buffering" }),
  playing: (): VideoStreamPlayState => ({ _tag: "Playing" }),
  paused: (): VideoStreamPlayState => ({ _tag: "Paused" }),
  finished: (): VideoStreamPlayState => ({ _tag: "Finished" }),
  stopped: (): VideoStreamPlayState => ({ _tag: "Stopped" }),
  error: (error: VideoStreamError): VideoStreamPlayState => ({ _tag: "Error", error }),
} as const;

/**
 * Type guards for VideoStreamPlayState
 */
export const isIdle = (state: VideoStreamPlayState): state is VideoStreamPlayState & { _tag: "Idle" } =>
  state._tag === "Idle";
export const isConnecting = (state: VideoStreamPlayState): state is VideoStreamPlayState & { _tag: "Connecting" } =>
  state._tag === "Connecting";
export const isBuffering = (state: VideoStreamPlayState): state is VideoStreamPlayState & { _tag: "Buffering" } =>
  state._tag === "Buffering";
export const isPlaying = (state: VideoStreamPlayState): state is VideoStreamPlayState & { _tag: "Playing" } =>
  state._tag === "Playing";
export const isPaused = (state: VideoStreamPlayState): state is VideoStreamPlayState & { _tag: "Paused" } =>
  state._tag === "Paused";
export const isFinished = (state: VideoStreamPlayState): state is VideoStreamPlayState & { _tag: "Finished" } =>
  state._tag === "Finished";
export const isStopped = (state: VideoStreamPlayState): state is VideoStreamPlayState & { _tag: "Stopped" } =>
  state._tag === "Stopped";
export const isError = (
  state: VideoStreamPlayState,
): state is VideoStreamPlayState & { _tag: "Error"; error: VideoStreamError } => state._tag === "Error";
