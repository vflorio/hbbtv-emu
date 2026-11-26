/**
 * Mapping functions between PlayerRuntime and VideoStream types
 */

import type { PlayerState } from "@hbb-emu/player-runtime";
import * as Runtime from "@hbb-emu/player-runtime";
import { pipe } from "fp-ts/function";
import { match } from "ts-pattern";
import { VideoStreamError } from "./errors";
import { VideoStreamPlayState } from "./state";

/**
 * Maps a PlayerRuntime state to the stream's play state, given the one it has now.
 *
 * The source's own sub-states (MPD parsed, representation or variant selected, quality
 * switching) tell how the source is doing, not whether the media plays: they come while it
 * is paused or playing, and the stream stays as it was. Read as idle, they took a DASH
 * broadcast through UNREALIZED and back at every start and every quality switch.
 */
export const mapRuntimeStateToPlayState = (
  state: PlayerState.Any,
  current: VideoStreamPlayState,
): VideoStreamPlayState =>
  pipe(
    match(state)
      .when(Runtime.isError, (errorState) => VideoStreamPlayState.error(createErrorFromRuntimeState(errorState)))
      .when(Runtime.isPlaying, () => VideoStreamPlayState.playing())
      .when(Runtime.isPaused, () => VideoStreamPlayState.paused())
      .when(Runtime.isLoading, () => VideoStreamPlayState.buffering())
      .when(Runtime.isBuffering, () => VideoStreamPlayState.buffering())
      .when(Runtime.isSeeking, () => VideoStreamPlayState.buffering())
      .when(Runtime.isEnded, () => VideoStreamPlayState.finished())
      .when(Runtime.isSourceState, () => current)
      .otherwise(() => VideoStreamPlayState.idle()),
  );

/**
 * Creates a VideoStreamError from PlayerRuntime error state
 */
export const createErrorFromRuntimeState = (state: PlayerState.Errors): VideoStreamError =>
  pipe(
    Runtime.matchPlayerState<VideoStreamError>(state)
      .with({ _tag: "Error/Network" }, () => VideoStreamError.network(state.error.message, 2, state))
      .with({ _tag: "Error/NotSupported" }, () => VideoStreamError.notSupported(state.error.message, 4, state))
      .with({ _tag: "Error/DRM" }, () => VideoStreamError.drm(state.error.message, 6, state))
      .otherwise(() => VideoStreamError.unknown(state.error.message, 1, state)),
  );
