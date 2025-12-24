import { Matchers, type PlayerEvent, PlayerRuntime, type PlayerState } from "@hbb-emu/player";
import { Box } from "@mui/material";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOO from "fp-ts/IOOption";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
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

export default function PlaybackProvider({ children }: { children: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const runtimeRef = useRef<PlayerRuntime | null>(null);
  const playerStateRef = useRef<PlayerState.Any | null>(null);

  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackType, setPlaybackType] = useState<string | null>(null);
  const [machineIteration, setMachineIteration] = useState(0);

  const [machineStateResults, setMachineStateResults] = useState<Record<string, any>>({});

  const createRuntime: IO.IO<PlayerRuntime> = () => {
    const runtime = new PlayerRuntime();

    const onStateChange = (state: PlayerState.Any) => {
      playerStateRef.current = state;

      updateMachineStateResults(state);
      setMachineIteration((current) => current + 1);

      setError(Matchers.getError(state)?.message ?? null);
      setIsLoading(Matchers.isLoading(state));

      const getPlaybackType = pipe(
        IOO.fromNullable(runtimeRef.current),
        IOO.flatMap((runtime) => IOO.fromOption(runtime.getPlaybackType())),
        IOO.toNullable,
      );
      setPlaybackType(getPlaybackType());
    };

    runtime.subscribe(onStateChange);

    return runtime;
  };

  useEffect(() => {
    const deps = pipe(
      O.Do,
      O.apS("runtime", O.fromNullable(runtimeRef.current)),
      O.apS("video", O.fromNullable(videoRef.current)),
    );

    const initializedRuntimeIfNotExists = pipe(
      O.fromNullable(runtimeRef.current),
      O.match(
        () =>
          pipe(
            createRuntime,
            IO.flatMap((runtime) => () => {
              runtimeRef.current = runtime;
            }),
          ),
        () => IO.of(undefined),
      ),
    );

    const mountVideoElement = pipe(
      deps,
      O.match(
        () => T.of(undefined),
        ({ runtime, video }) => runtime.mount(video),
      ),
    );

    const dispatchLoadIfSourceIsPresent = pipe(
      O.Do,
      O.apS("runtime", O.fromNullable(runtimeRef.current)),
      O.apS("src", O.fromNullable(source)),
      O.match(
        () => T.of(undefined),
        ({ runtime, src }) => runtime.dispatch({ _tag: "Intent/LoadRequested", url: src }),
      ),
    );

    pipe(
      T.fromIO(initializedRuntimeIfNotExists),
      T.flatMap(() => mountVideoElement),
      T.flatMap(() => dispatchLoadIfSourceIsPresent),
    )();
  }, [source]);

  useEffect(() => {
    pipe(
      O.fromNullable(playerStateRef.current),
      O.match(
        () => setMachineStateResults({}),
        (state) => updateMachineStateResults(state),
      ),
    );
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

export const usePlayback = () => {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error("usePlayback must be used within PlaybackProvider");
  }
  return context;
};
