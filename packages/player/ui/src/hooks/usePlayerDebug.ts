import type { PlayerEvent, PlayerRuntime, PlayerState } from "@hbb-emu/player-runtime";
import { useEffect, useRef, useState } from "react";
import { match, P } from "ts-pattern";

export type RuntimeDebugEntry =
  | {
      readonly id: number;
      readonly kind: "intent" | "engine" | "error" | "core-error";
      readonly time: number;
      readonly event: PlayerEvent;
    }
  | {
      readonly id: number;
      readonly kind: "state";
      readonly time: number;
      readonly from: string;
      readonly to: string;
    };

type NewRuntimeDebugEntry =
  | {
      readonly kind: "intent" | "engine" | "error" | "core-error";
      readonly time: number;
      readonly event: PlayerEvent;
    }
  | {
      readonly kind: "state";
      readonly time: number;
      readonly from: string;
      readonly to: string;
    };

export function usePlayerDebug(playerRuntime: PlayerRuntime) {
  const nextIdRef = useRef(1);
  const previousStateTagRef = useRef<string | null>(null);

  const [playerState, setPlayerState] = useState<PlayerState.Any | null>(null);
  const [entries, setEntries] = useState<readonly RuntimeDebugEntry[]>([]);

  const pushEntry = (entry: NewRuntimeDebugEntry) => {
    const id = nextIdRef.current++;
    const nextEntry = { ...entry, id } as RuntimeDebugEntry;
    setEntries((prev) => [...prev, nextEntry]);
  };

  const clearEntries = () => {
    setEntries([]);
  };

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = playerRuntime.subscribeToState((state: PlayerState.Any) => {
      const prev = previousStateTagRef.current;
      if (prev !== null && prev !== state._tag) {
        pushEntry({
          kind: "state",
          time: Date.now(),
          from: prev,
          to: state._tag,
        });
      }
      previousStateTagRef.current = state._tag;
      setPlayerState(state);
    })();

    return () => {
      unsubscribe();
      previousStateTagRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerRuntime]);

  // Subscribe to events
  useEffect(() => {
    const unsubscribe = playerRuntime.subscribeToEvents((event: PlayerEvent) => {
      const kind = match(event._tag)
        .with(P.string.startsWith("Intent/"), () => "intent" as const)
        .with(P.string.startsWith("Engine/"), () => "engine" as const)
        .with(P.string.startsWith("CoreError/"), () => "core-error" as const)
        .otherwise(() => "error" as const);

      pushEntry({ kind, time: Date.now(), event });
    })();

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerRuntime]);

  return { playerState, entries, clearEntries };
}
