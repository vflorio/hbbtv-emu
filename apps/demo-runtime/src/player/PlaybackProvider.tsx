import { Matchers, type PlayerEvent, PlayerRuntime, type PlayerState } from "@hbb-emu/player";
import { Box } from "@mui/material";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

export type PlaybackContextType = {
  playbackType: string | null;
  playerState: PlayerState.Any | null;
  videoElement: HTMLVideoElement | null;
  error: string | null;
  isLoading: boolean;
  loadSource: (source: string) => void;
  dispatch: (event: PlayerEvent) => void;
  matcherResults: Record<string, any>;
  renderVideoElement: () => ReactNode;
};

const PlaybackContext = createContext<PlaybackContextType | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const runtimeRef = useRef<PlayerRuntime | null>(null);
  const playerStateRef = useRef<PlayerState.Any | null>(null);

  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackType, setPlaybackType] = useState<string | null>(null);
  const [machineIteration, setMachineIteration] = useState(0);

  const [machineStateResults, setMachineStateResults] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!runtimeRef.current) {
      runtimeRef.current = new PlayerRuntime();
      runtimeRef.current.subscribe((state) => {
        playerStateRef.current = state;
        updateMachineStateResults(state);
        setMachineIteration((current) => current + 1);

        const err = Matchers.getError(state);
        setError(err ? err.message : null);
        setIsLoading(Matchers.isLoading(state));
        setPlaybackType(runtimeRef.current?.getPlaybackType() ?? null);
      });
    }

    if (videoRef.current) {
      runtimeRef.current.mount(videoRef.current);
    }

    return () => {
      // non distruggiamo il runtime ad ogni unmount del provider
    };
  }, [source]);

  useEffect(() => {
    if (!source || !runtimeRef.current) return;
    runtimeRef.current.dispatch({ _tag: "Intent/LoadRequested", url: source });
  }, [source]);

  useEffect(() => {
    if (!playerStateRef.current) {
      setMachineStateResults({});
      return;
    }

    updateMachineStateResults(playerStateRef.current);
  }, [machineIteration]);

  const updateMachineStateResults = (state: PlayerState.Any) =>
    setMachineStateResults({
      // State predicates
      isPlayable: Matchers.isPlayable(state),
      isError: Matchers.isError(state),
      isRecoverable: Matchers.isRecoverable(state),
      isFatal: Matchers.isFatal(state),
      isControlState: Matchers.isControlState(state),
      isSourceState: Matchers.isSourceState(state),
      isHLSState: Matchers.isHLSState(state),
      isDASHState: Matchers.isDASHState(state),
      isMP4State: Matchers.isMP4State(state),

      // Status predicates
      isPlaying: Matchers.isPlaying(state),
      isPaused: Matchers.isPaused(state),
      isLoading: Matchers.isLoading(state),

      // Capabilities
      canSeek: Matchers.canSeek(state),
      canControl: Matchers.canControl(state),

      // Data extraction
      currentTime: Matchers.getCurrentTime(state),
      duration: Matchers.getDuration(state),
      bufferedRanges: Matchers.getBufferedRanges(state),
      error: Matchers.getError(state),
      retryCount: Matchers.getRetryCount(state),

      // Description
      description: Matchers.getStateDescription(state),

      // Raw state
      _tag: state._tag,
      _tagGroup: state._tagGroup,
    });

  const loadSource = (newSource: string) => {
    setSource(newSource);
  };

  const dispatch = (event: PlayerEvent) => {
    runtimeRef.current?.dispatch(event);
  };

  return (
    <PlaybackContext.Provider
      value={{
        playbackType,
        playerState: playerStateRef.current,
        videoElement: videoRef.current,
        error,
        isLoading,
        loadSource,
        dispatch,
        matcherResults: machineStateResults,
        renderVideoElement: () => (
          <Box
            component="video"
            ref={videoRef}
            controls
            sx={{
              width: 720,
              height: "100%",
              bgcolor: "black",
            }}
          />
        ),
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error("usePlayback must be used within PlaybackProvider");
  }
  return context;
}
