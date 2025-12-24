import type { PlayerEvent, PlayerRuntime, PlayerState } from "@hbb-emu/player-runtime";
import { useEffect, useMemo, useRef, useState } from "react";

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

  const entriesRef = useRef<RuntimeDebugEntry[]>([]);

  const [playerState, setPlayerState] = useState<PlayerState.Any | null>(null);
  const [entriesVersion, setEntriesVersion] = useState(0);

  const pushEntry = (entry: NewRuntimeDebugEntry) => {
    const id = nextIdRef.current++;
    const nextEntry = { ...entry, id } as RuntimeDebugEntry;
    entriesRef.current.push(nextEntry);
    setEntriesVersion((v) => v + 1);
  };

  const clearEntries = () => {
    entriesRef.current.length = 0;
    setEntriesVersion((v) => v + 1);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerRuntime]);

  // Subscribe to events
  useEffect(() => {
    const unsubscribe = playerRuntime.subscribeToEvents((event: PlayerEvent) => {
      const kind: RuntimeDebugEntry["kind"] = event._tag.startsWith("Intent/")
        ? "intent"
        : event._tag.startsWith("Engine/")
          ? "engine"
          : event._tag.startsWith("CoreError/")
            ? "core-error"
            : "error";

      console.log("[usePlayerDebug] Event received:", event._tag, "kind:", kind);
      pushEntry({ kind, time: Date.now(), event });
    })();

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerRuntime]);

  const entries = useMemo(() => entriesRef.current as readonly RuntimeDebugEntry[], [entriesVersion]);

  return { playerState, entries, entriesVersion, clearEntries };
}
