import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import { usePlayback } from "../player/PlaybackProvider";
import type { RuntimeDebugEntry } from "../player/types";

type TransitionLine = { readonly id: number; readonly value: string };
type RuntimeEventEntry = Exclude<RuntimeDebugEntry, { readonly kind: "state" }>;

export const useTransitionGroups = () => {
  const { transitions } = usePlayback();

  const matchState = (entry: RuntimeDebugEntry): O.Option<TransitionLine> =>
    entry.kind === "state" ? O.some(formatState(entry)) : O.none;

  const matchIntent = (entry: RuntimeDebugEntry): O.Option<TransitionLine> =>
    entry.kind === "intent" ? O.some(formatIntent(entry)) : O.none;

  const matchError = (entry: RuntimeDebugEntry): O.Option<TransitionLine> =>
    entry.kind === "error" ? O.some(formatError(entry)) : O.none;

  const matchEngine = (entry: RuntimeDebugEntry): O.Option<TransitionLine> =>
    entry.kind === "engine" ? O.some(formatEngine(entry)) : O.none;

  const group = (toEntry: (entry: RuntimeDebugEntry) => O.Option<TransitionLine>) =>
    pipe(
      transitions,
      RA.reverse,
      RA.filterMap(toEntry), // Map & filter O.none
    );

  return {
    state: group(matchState),
    intents: group(matchIntent),
    engine: pipe(group(matchEngine), RA.takeLeft(25)),
    errors: group(matchError),
  };
};

const formatTime = (ms: number) => {
  const d = new Date(ms);
  const iso = d.toISOString();
  return iso.split("T")[1]?.split("Z")[0] ?? iso;
};

const mkLine = (t: RuntimeEventEntry) => `${formatTime(t.time)} ${t.event._tag}`;

const formatState = (t: Extract<RuntimeDebugEntry, { readonly kind: "state" }>): TransitionLine => ({
  id: t.id,
  value: `${formatTime(t.time)} ${t.from} -> ${t.to}`,
});

const formatIntent = (t: RuntimeEventEntry): TransitionLine => ({
  id: t.id,
  value: mkLine(t),
});

const formatError = (t: RuntimeEventEntry): TransitionLine => {
  const baseLine = mkLine(t);
  const msg = "message" in t.event ? String((t.event as { readonly message?: unknown }).message ?? "") : "";
  return {
    id: t.id,
    value: msg ? `${baseLine} — ${String(msg)}` : baseLine,
  };
};

const formatEngine = (t: RuntimeEventEntry): TransitionLine => ({
  id: t.id,
  value: mkLine(t),
});
