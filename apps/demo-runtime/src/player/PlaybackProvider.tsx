import { Matchers, type PlayerEvent, PlayerRuntime, type PlayerState } from "@hbb-emu/player";
import { Box } from "@mui/material";
import { pipe } from "fp-ts/function";
import * as IOO from "fp-ts/IOOption";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

import type { PlaybackContextType, RuntimeDebugEntry } from "./types";

const PlaybackContext = createContext<PlaybackContextType | null>(null);

export default function PlaybackProvider({ children }: { children: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const runtimeRef = useRef<PlayerRuntime | null>(null);
  const previousStateTagRef = useRef<string | null>(null);
  const nextDebugIdRef = useRef(1);

  const [source, setSource] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState.Any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackType, setPlaybackType] = useState<string | null>(null);
  const [transitions, setTransitions] = useState<RuntimeDebugEntry[]>([]);

  useEffect(() => {
    const runtime = new PlayerRuntime({
      onDispatch: (event: PlayerEvent) => {
        const kind: RuntimeDebugEntry["kind"] = event._tag.startsWith("Intent/")
          ? "intent"
          : event._tag === "Engine/Error"
            ? "error"
            : "engine";

        setTransitions((prev) => {
          const next = prev.concat([
            {
              id: nextDebugIdRef.current++,
              kind,
              time: Date.now(),
              event,
            },
          ]);
          return next.length > 200 ? next.slice(next.length - 200) : next;
        });
      },
    });
    runtimeRef.current = runtime;

    const unsubscribe = runtime.subscribe((state) => {
      const prev = previousStateTagRef.current;
      if (prev !== null && prev !== state._tag) {
        setTransitions((entries) => {
          const next = entries.concat([
            {
              id: nextDebugIdRef.current++,
              kind: "state",
              time: Date.now(),
              from: prev,
              to: state._tag,
            },
          ]);
          return next.length > 200 ? next.slice(next.length - 200) : next;
        });
      }
      previousStateTagRef.current = state._tag;

      setPlayerState(state);
      setError(Matchers.getError(state)?.message ?? null);
      setIsLoading(Matchers.isLoading(state));
      setPlaybackType(pipe(runtime.getPlaybackType, IOO.toNullable)());
    })();

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const video = videoRef.current;
    if (!runtime || !video) return;

    runtime.mount(video)();
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !source) return;
    runtime.dispatch({ _tag: "Intent/LoadRequested", url: source })();
  }, [source]);

  const loadSource = (newSource: string) => {
    setSource(newSource);
  };

  const dispatch = (event: PlayerEvent) => {
    runtimeRef.current?.dispatch(event)();
  };

  return (
    <PlaybackContext.Provider
      value={{
        playbackType,
        playerState,
        videoElement: videoRef.current,
        error,
        isLoading,
        loadSource,
        dispatch,
        transitions,
        renderVideoElement: () => (
          <Box
            component="video"
            ref={videoRef}
            controls
            sx={{
              width: 720,
              height: "100%",
              bgcolor: "black",
              aspectRatio: "16 / 9",
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
