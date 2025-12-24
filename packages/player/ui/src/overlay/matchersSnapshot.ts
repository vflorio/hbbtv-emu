import type { PlayerState } from "@hbb-emu/player-runtime";
import * as Matchers from "@hbb-emu/player-runtime";

export type MatcherItem = {
  readonly key: string;
  readonly label: string;
  readonly value: unknown;
};

export type MatcherSnapshot = {
  readonly stateTypes: readonly MatcherItem[];
  readonly status: readonly MatcherItem[];
  readonly capabilities: readonly MatcherItem[];
  readonly extracted: readonly MatcherItem[];
  readonly description: string;
};

export const getMatcherSnapshot = (playerState: PlayerState.Any | null): MatcherSnapshot => {
  if (playerState === null) {
    return {
      stateTypes: [
        { key: "isPlayable", label: "isPlayable", value: false },
        { key: "isError", label: "isError", value: false },
        { key: "isRecoverable", label: "isRecoverable", value: false },
        { key: "isFatal", label: "isFatal", value: false },
        { key: "isControlState", label: "isControlState", value: false },
        { key: "isSourceState", label: "isSourceState", value: false },
        { key: "isNativeState", label: "isNativeState", value: false },
        { key: "isHLSState", label: "isHLSState", value: false },
        { key: "isDASHState", label: "isDASHState", value: false },
      ],
      status: [
        { key: "isPlaying", label: "isPlaying", value: false },
        { key: "isPaused", label: "isPaused", value: false },
        { key: "isLoading", label: "isLoading", value: false },
      ],
      capabilities: [
        { key: "canSeek", label: "canSeek", value: false },
        { key: "canControl", label: "canControl", value: false },
      ],
      extracted: [
        { key: "getCurrentTime", label: "getCurrentTime()", value: null },
        { key: "getDuration", label: "getDuration()", value: null },
        { key: "getError", label: "getError()", value: null },
        { key: "getRetryCount", label: "getRetryCount()", value: null },
      ],
      description: "",
    };
  }

  return {
    stateTypes: [
      { key: "isPlayable", label: "isPlayable", value: Matchers.isPlayable(playerState) },
      { key: "isError", label: "isError", value: Matchers.isError(playerState) },
      { key: "isRecoverable", label: "isRecoverable", value: Matchers.isRecoverable(playerState) },
      { key: "isFatal", label: "isFatal", value: Matchers.isFatal(playerState) },
      { key: "isControlState", label: "isControlState", value: Matchers.isControlState(playerState) },
      { key: "isSourceState", label: "isSourceState", value: Matchers.isSourceState(playerState) },
      { key: "isHLSState", label: "isHLSState", value: Matchers.isHLSState(playerState) },
      { key: "isDASHState", label: "isDASHState", value: Matchers.isDASHState(playerState) },
      { key: "isNativeState", label: "isNativeState", value: Matchers.isNativeState(playerState) },
    ],
    status: [
      { key: "isPlaying", label: "isPlaying", value: Matchers.isPlaying(playerState) },
      { key: "isPaused", label: "isPaused", value: Matchers.isPaused(playerState) },
      { key: "isLoading", label: "isLoading", value: Matchers.isLoading(playerState) },
    ],
    capabilities: [
      { key: "canSeek", label: "canSeek", value: Matchers.canSeek(playerState) },
      { key: "canControl", label: "canControl", value: Matchers.canControl(playerState) },
    ],
    extracted: [
      { key: "getCurrentTime", label: "getCurrentTime()", value: Matchers.getCurrentTime(playerState) },
      { key: "getDuration", label: "getDuration()", value: Matchers.getDuration(playerState) },
      {
        key: "getError",
        label: "getError()",
        value: Matchers.getError(playerState)?.message ?? null,
      },
      { key: "getRetryCount", label: "getRetryCount()", value: Matchers.getRetryCount(playerState) },
    ],
    description: Matchers.getStateDescription(playerState),
  };
};
