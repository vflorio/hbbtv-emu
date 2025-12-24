import type { PlayerCore, PlayerEvent, PlayerState } from "@hbb-emu/player-core";
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

const DISPATCH_WRAPPED = Symbol.for("@hbb-emu/player-ui/dispatch-wrapped");

type DispatchFn = PlayerCore["dispatch"];

type WrappedDispatchMeta = {
  original: DispatchFn;
  wrapCount: number;
};

const getWrappedMeta = (core: PlayerCore): WrappedDispatchMeta | null =>
  (core as unknown as Record<symbol, unknown>)[DISPATCH_WRAPPED] as WrappedDispatchMeta | null;

const setWrappedMeta = (core: PlayerCore, meta: WrappedDispatchMeta | null) => {
  const bag = core as unknown as Record<symbol, unknown>;
  if (meta === null) {
    delete bag[DISPATCH_WRAPPED];
  } else {
    bag[DISPATCH_WRAPPED] = meta;
  }
};

export function usePlayerDebug(core: PlayerCore) {
  const nextIdRef = useRef(1);
  const previousStateTagRef = useRef<string | null>(null);

  const [playerState, setPlayerState] = useState<PlayerState.Any | null>(null);
  const [entries, setEntries] = useState<readonly RuntimeDebugEntry[]>([]);

  const pushEntry = (entry: NewRuntimeDebugEntry) => {
    const id = nextIdRef.current++;
    setEntries((prev) => {
      const nextEntry = { ...entry, id } as RuntimeDebugEntry;
      const next = prev.concat([nextEntry]);
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
  };

  useEffect(() => {
    const unsubscribe = core.subscribe((state: PlayerState.Any) => {
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
  }, [core]);

  useEffect(() => {
    const meta = getWrappedMeta(core);
    if (meta) {
      setWrappedMeta(core, { ...meta, wrapCount: meta.wrapCount + 1 });
      return () => {
        const m = getWrappedMeta(core);
        if (!m) return;
        const next = m.wrapCount - 1;
        if (next <= 0) {
          core.dispatch = m.original;
          setWrappedMeta(core, null);
        } else {
          setWrappedMeta(core, { ...m, wrapCount: next });
        }
      };
    }

    const original = core.dispatch.bind(core);

    const wrapped: DispatchFn = (event: PlayerEvent) => {
      const kind: RuntimeDebugEntry["kind"] = event._tag.startsWith("Intent/")
        ? "intent"
        : event._tag.startsWith("Engine/")
          ? "engine"
          : event._tag.startsWith("CoreError/")
            ? "core-error"
            : "error";

      pushEntry({ kind, time: Date.now(), event });
      return original(event);
    };

    core.dispatch = wrapped;
    setWrappedMeta(core, { original, wrapCount: 1 });

    return () => {
      const m = getWrappedMeta(core);
      if (!m) return;
      const next = m.wrapCount - 1;
      if (next <= 0) {
        core.dispatch = m.original;
        setWrappedMeta(core, null);
      } else {
        setWrappedMeta(core, { ...m, wrapCount: next });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core]);

  const latest = useMemo(() => entries.slice(-200), [entries]);

  return { playerState, entries: latest };
}
