import { createLogger } from "@hbb-emu/core";
import { Matchers, Playback, type PlaybackErrors, type PlayerState } from "@hbb-emu/player";
import { Box } from "@mui/material";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as TE from "fp-ts/TaskEither";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

export type PlaybackContextType = {
  playback: Playback.Any | null;
  playerState: PlayerState.Any | null;
  videoElement: HTMLVideoElement | null;
  error: string | null;
  isLoading: boolean;
  loadSource: (source: string) => void;
  matcherResults: Record<string, any>;
};

const PlaybackContext = createContext<PlaybackContextType | null>(null);

const logger = createLogger("PlaybackProvider");

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<Playback.Any | null>(null);
  const playerStateRef = useRef<PlayerState.Any | null>(null);

  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackReady, setPlaybackReady] = useState(false);
  const [stateVersion, setStateVersion] = useState(0);

  const [matcherResults, setMatcherResults] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!source || !videoRef.current) {
      return;
    }

    const reset = async () => {
      if (!playbackRef.current || !videoRef.current) return;
      await cleanup(playbackRef.current, videoRef.current)();
      playbackRef.current = null;
      setPlaybackReady(false);
    };

    reset().then(() => {
      if (videoRef.current) {
        init(source, videoRef.current)();
      }
    });
  }, [source]);

  useEffect(() => {
    if (!playbackReady || !playbackRef.current) return;

    const interval = setInterval(() => {
      if (playbackRef.current) {
        updatePlayerState(playbackRef.current)();
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [playbackReady]);

  useEffect(() => {
    if (!playerStateRef.current) {
      setMatcherResults({});
      return;
    }

    updateMatcherResults(playerStateRef.current);
  }, [stateVersion]);

  const setPlayback =
    (playback: Playback.Any): IO.IO<void> =>
    () => {
      playbackRef.current = playback;
      setError(null);
      setIsLoading(false);
      setPlaybackReady(true);
    };

  const setPlaybackError =
    // TODO Differenziare strategia per PlaybackErrors.Fatal|Recoverable
      (playbackError: PlaybackErrors.Any): IO.IO<void> =>
      () => {
        playbackRef.current = null;
        setError(playbackError.message);
        setIsLoading(false);
      };

  const init = (source: string, element: HTMLVideoElement): TE.TaskEither<PlaybackErrors.Any, Playback.Any> =>
    pipe(
      TE.Do,
      TE.flatMap(() => pipe(Playback.create(source), TE.orElseFirstIOK(setPlaybackError))),
      TE.tap((playback) => pipe(playback.initialize(element), TE.orElseFirstIOK(setPlaybackError))),
      TE.tap((playback) => pipe(playback.load(), TE.orElseFirstIOK(setPlaybackError))),
      TE.tap(TE.fromIOK(setPlayback)),
      TE.tapIO(() => logger.info("Initialized")),
    );

  const cleanup = (playback: Playback.Any, element: HTMLVideoElement): TE.TaskEither<PlaybackErrors.Any, {}> =>
    pipe(
      TE.Do,
      TE.tapIO(
        IO.of(() => {
          element.pause();
          element.src = "";
        }),
      ),
      TE.tap(() => pipe(playback.destroy(), TE.orElseFirstIOK(setPlaybackError))),
      TE.tapIO(() => logger.info("Cleaned up")),
    );

  const updatePlayerState = (playback: Playback.Any): TE.TaskEither<PlaybackErrors.Any, void> =>
    pipe(
      TE.Do,
      TE.flatMap(() => playback.getState()),
      TE.map((state) => {
        playerStateRef.current = state;
        updateMatcherResults(state);
        setStateVersion((v) => v + 1);
      }),
      TE.orElseFirstIOK(() => logger.error("[Playback Provider] Failed to update state")),
      TE.tapIO(() => logger.info("[Playback Provider] State updated")),
    );

  const updateMatcherResults = (state: PlayerState.Any) =>
    setMatcherResults({
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
    setIsLoading(true);
    setPlaybackReady(false);
    setSource(newSource);
  };

  return (
    <PlaybackContext.Provider
      value={{
        playback: playbackRef.current,
        playerState: playerStateRef.current,
        videoElement: videoRef.current,
        error,
        isLoading,
        loadSource,
        matcherResults,
      }}
    >
      <Box
        component="video"
        ref={videoRef}
        controls
        sx={{
          width: "100%",
          maxHeight: 400,
          bgcolor: "black",
        }}
      />
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
