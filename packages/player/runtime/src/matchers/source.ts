import { match } from "ts-pattern";
import type { Match, PlayerState, SourceMetadata } from "..";

export const matchHLSState = <T>(state: PlayerState.Source.HLS.Any): Match<PlayerState.Source.HLS.Any, T> =>
  match<PlayerState.Source.HLS.Any, T>(state);

export const matchDASHState = <T>(state: PlayerState.Source.DASH.Any): Match<PlayerState.Source.DASH.Any, T> =>
  match<PlayerState.Source.DASH.Any, T>(state);

export const matchNativeState = <T>(state: PlayerState.Source.Native.Any): Match<PlayerState.Source.Native.Any, T> =>
  match<PlayerState.Source.Native.Any, T>(state);

// Utils

export const getQualityInfo = (state: PlayerState.Any) =>
  match(state)
    .with({ _tag: "Source/HLS/VariantSelected" }, (s) => ({
      type: "hls" as const,
      bandwidth: s.bandwidth,
      resolution: s.resolution,
      variant: s.variant,
    }))
    .with({ _tag: "Source/DASH/RepresentationSelected" }, (s) => ({
      type: "dash" as const,
      bandwidth: s.bandwidth,
      resolution: s.resolution,
      representation: s.representation,
    }))
    .when(
      (s): s is Extract<PlayerState.Any, { source?: SourceMetadata }> => "source" in s && !!s.source,
      (s) => ({
        type: s.source!.playbackType,
        resolution: s.source!.resolution,
        codec: s.source!.codec,
      }),
    )
    .otherwise(() => null);
