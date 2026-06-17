import type { PlaybackType, PlayerEffect } from "..";

export type ReduceResult<T> = {
  readonly next: T;
  readonly effects: readonly PlayerEffect[];
};

export const detectPlaybackType = (url: string): PlaybackType => {
  if (url.endsWith(".m3u8") || url.includes(".m3u8?")) return "hls";
  if (url.endsWith(".mpd") || url.includes(".mpd?")) return "dash";
  return "native";
};
