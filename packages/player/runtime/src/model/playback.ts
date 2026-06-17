import type { TimeRange } from "../states";

export type PlaybackType = "native" | "hls" | "dash";

export type PlaybackSnapshot = {
  readonly currentTime: number;
  readonly duration: number;
  readonly buffered: TimeRange[];
  readonly playbackRate: number;
  readonly paused: boolean;
};

export interface PlaybackData<TConfig> {
  readonly source: string;
  readonly config: TConfig;
}
