import { Matchers, type PlayerState } from "@hbb-emu/player";

export type MatcherResults = {
  // State predicates
  isPlayable: boolean;
  isError: boolean;
  isRecoverable: boolean;
  isFatal: boolean;
  isControlState: boolean;
  isSourceState: boolean;
  isHLSState: boolean;
  isDASHState: boolean;
  isMP4State: boolean;

  // Status predicates
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;

  // Capabilities
  canSeek: boolean;
  canControl: boolean;

  // Data extraction
  currentTime: number | null;
  duration: number | null;
  bufferedRanges: readonly any[];
  error: Error | null;
  retryCount: number | null;

  // Description
  description: string;

  // Raw state
  _tag: PlayerState.Any["_tag"] | null;
  _tagGroup: PlayerState.Any["_tagGroup"] | null;
};

export const getMatcherResults = (playerState: PlayerState.Any | null): MatcherResults => {
  if (playerState === null) {
    return {
      isPlayable: false,
      isError: false,
      isRecoverable: false,
      isFatal: false,
      isControlState: false,
      isSourceState: false,
      isHLSState: false,
      isDASHState: false,
      isMP4State: false,

      isPlaying: false,
      isPaused: false,
      isLoading: false,

      canSeek: false,
      canControl: false,

      currentTime: null,
      duration: null,
      bufferedRanges: [],
      error: null,
      retryCount: null,

      description: "",

      _tag: null,
      _tagGroup: null,
    };
  }

  return {
    isPlayable: Matchers.isPlayable(playerState),
    isError: Matchers.isError(playerState),
    isRecoverable: Matchers.isRecoverable(playerState),
    isFatal: Matchers.isFatal(playerState),
    isControlState: Matchers.isControlState(playerState),
    isSourceState: Matchers.isSourceState(playerState),
    isHLSState: Matchers.isHLSState(playerState),
    isDASHState: Matchers.isDASHState(playerState),
    isMP4State: Matchers.isMP4State(playerState),

    isPlaying: Matchers.isPlaying(playerState),
    isPaused: Matchers.isPaused(playerState),
    isLoading: Matchers.isLoading(playerState),

    canSeek: Matchers.canSeek(playerState),
    canControl: Matchers.canControl(playerState),

    currentTime: Matchers.getCurrentTime(playerState),
    duration: Matchers.getDuration(playerState),
    bufferedRanges: Matchers.getBufferedRanges(playerState),
    error: Matchers.getError(playerState),
    retryCount: Matchers.getRetryCount(playerState),

    description: Matchers.getStateDescription(playerState),

    _tag: playerState._tag,
    _tagGroup: playerState._tagGroup,
  };
};
