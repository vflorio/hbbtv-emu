/**
 * State Mapping
 *
 * Maps between unified player states and HbbTV API-specific states.
 */

import type { ApiType } from "./types";
import { UnifiedPlayState } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// AVControl PlayState (from core)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AVControl PlayState values.
 * Matches Control.PlayState from @hbb-emu/core.
 */
export const AVControlPlayState = {
  STOPPED: 0,
  PLAYING: 1,
  PAUSED: 2,
  CONNECTING: 3,
  BUFFERING: 4,
  FINISHED: 5,
  ERROR: 6,
} as const;

export type AVControlPlayState = (typeof AVControlPlayState)[keyof typeof AVControlPlayState];

// ─────────────────────────────────────────────────────────────────────────────
// VideoBroadcast PlayState (from core)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * VideoBroadcast PlayState values.
 * Matches Broadcast.VideoBroadcast.PlayState from @hbb-emu/core.
 */
export const VideoBroadcastPlayState = {
  UNREALIZED: 0,
  CONNECTING: 1,
  PRESENTING: 2,
  STOPPED: 3,
} as const;

export type VideoBroadcastPlayState = (typeof VideoBroadcastPlayState)[keyof typeof VideoBroadcastPlayState];

// ─────────────────────────────────────────────────────────────────────────────
// State Mapping: Unified → API-specific
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map unified state to AVControl PlayState.
 */
export const unifiedToAvControl = (state: UnifiedPlayState): AVControlPlayState => {
  switch (state) {
    case UnifiedPlayState.IDLE:
    case UnifiedPlayState.STOPPED:
      return AVControlPlayState.STOPPED;
    case UnifiedPlayState.CONNECTING:
      return AVControlPlayState.CONNECTING;
    case UnifiedPlayState.BUFFERING:
      return AVControlPlayState.BUFFERING;
    case UnifiedPlayState.PLAYING:
      return AVControlPlayState.PLAYING;
    case UnifiedPlayState.PAUSED:
      return AVControlPlayState.PAUSED;
    case UnifiedPlayState.FINISHED:
      return AVControlPlayState.FINISHED;
    case UnifiedPlayState.ERROR:
      return AVControlPlayState.ERROR;
  }
};

/**
 * Map unified state to VideoBroadcast PlayState.
 */
export const unifiedToVideoBroadcast = (state: UnifiedPlayState): VideoBroadcastPlayState => {
  switch (state) {
    case UnifiedPlayState.IDLE:
      return VideoBroadcastPlayState.UNREALIZED;
    case UnifiedPlayState.CONNECTING:
    case UnifiedPlayState.BUFFERING:
      return VideoBroadcastPlayState.CONNECTING;
    case UnifiedPlayState.PLAYING:
    case UnifiedPlayState.PAUSED: // VideoBroadcast doesn't have PAUSED, treat as PRESENTING
      return VideoBroadcastPlayState.PRESENTING;
    case UnifiedPlayState.STOPPED:
    case UnifiedPlayState.FINISHED:
    case UnifiedPlayState.ERROR:
      return VideoBroadcastPlayState.STOPPED;
  }
};

/**
 * Map unified state to API-specific state based on API type.
 */
export const unifiedToApiState = <T extends ApiType>(
  apiType: T,
  state: UnifiedPlayState,
): T extends "avControl" ? AVControlPlayState : VideoBroadcastPlayState =>
  (apiType === "avControl" ? unifiedToAvControl(state) : unifiedToVideoBroadcast(state)) as T extends "avControl"
    ? AVControlPlayState
    : VideoBroadcastPlayState;

// ─────────────────────────────────────────────────────────────────────────────
// State Mapping: API-specific → Unified
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map AVControl PlayState to unified state.
 */
export const avControlToUnified = (state: AVControlPlayState): UnifiedPlayState => {
  switch (state) {
    case AVControlPlayState.STOPPED:
      return UnifiedPlayState.STOPPED;
    case AVControlPlayState.PLAYING:
      return UnifiedPlayState.PLAYING;
    case AVControlPlayState.PAUSED:
      return UnifiedPlayState.PAUSED;
    case AVControlPlayState.CONNECTING:
      return UnifiedPlayState.CONNECTING;
    case AVControlPlayState.BUFFERING:
      return UnifiedPlayState.BUFFERING;
    case AVControlPlayState.FINISHED:
      return UnifiedPlayState.FINISHED;
    case AVControlPlayState.ERROR:
      return UnifiedPlayState.ERROR;
  }
};

/**
 * Map VideoBroadcast PlayState to unified state.
 */
export const videoBroadcastToUnified = (state: VideoBroadcastPlayState): UnifiedPlayState => {
  switch (state) {
    case VideoBroadcastPlayState.UNREALIZED:
      return UnifiedPlayState.IDLE;
    case VideoBroadcastPlayState.CONNECTING:
      return UnifiedPlayState.CONNECTING;
    case VideoBroadcastPlayState.PRESENTING:
      return UnifiedPlayState.PLAYING;
    case VideoBroadcastPlayState.STOPPED:
      return UnifiedPlayState.STOPPED;
  }
};
