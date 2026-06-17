import type { TimeRange } from "../states";

export type PlaybackType = "native" | "hls" | "dash";

export const detectPlaybackType = (url: string): PlaybackType => {
  if (url.endsWith(".m3u8") || url.includes(".m3u8?")) return "hls";
  if (url.endsWith(".mpd") || url.includes(".mpd?")) return "dash";
  return "native";
};

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
