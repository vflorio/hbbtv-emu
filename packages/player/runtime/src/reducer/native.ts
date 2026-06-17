import { match } from "ts-pattern";
import { PlayerState } from "../states";
import type { ReduceResult } from "./types";

export const handleNativeProgressiveLoading = (
  state: PlayerState.Any,
  url: string,
  bytesLoaded: number,
  bytesTotal: number,
  canPlayThrough: boolean,
): ReduceResult<PlayerState.Any> =>
  match(state)
    .with({ _tag: "Control/Loading" }, () => ({
      next: new PlayerState.Source.Native.ProgressiveLoading(url, bytesLoaded, bytesTotal, canPlayThrough),
      effects: [] as const,
    }))
    .with({ _tag: "Source/Native/ProgressiveLoading" }, () => ({
      next: new PlayerState.Source.Native.ProgressiveLoading(url, bytesLoaded, bytesTotal, canPlayThrough),
      effects: [] as const,
    }))
    // Ignore ProgressiveLoading events when already in Ready or playing states
    .otherwise(() => ({ next: state, effects: [] as const }));
