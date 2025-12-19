import { match } from "ts-pattern";
import { DashPlayer, HlsPlayer, HtmlVideoPlayer, type Player, type PlayerSourceType } from "./players";

export type VideoStreamEnv = Readonly<{
  /** Creates a Player implementation for a given source type */
  createPlayer: (sourceType: PlayerSourceType, videoElement?: HTMLVideoElement) => Player;

  /** Determines the best Player type for a URL (if source.type is omitted) */
  detectSourceType: (url: string) => PlayerSourceType;
}>;

/**
 * Default deps wired to existing Player implementations.
 *
 * This is intentionally *not* integrated into runtime yet.
 */
export const createDefaultVideoStreamEnv = (): VideoStreamEnv => ({
  createPlayer,
  detectSourceType,
});

const detectSourceType = (url: string): PlayerSourceType =>
  match(url.toLowerCase())
    .when(
      (u) => u.endsWith(".mpd") || u.includes("dash"),
      () => "dash" as const,
    )
    .when(
      (u) => u.endsWith(".m3u8") || u.includes("hls"),
      () => "hls" as const,
    )
    .otherwise(() => "video" as const);

const createPlayer = (sourceType: PlayerSourceType, videoElement?: HTMLVideoElement) =>
  match(sourceType)
    .with("video", () => new HtmlVideoPlayer(videoElement))
    .with("dash", () => new DashPlayer(videoElement))
    .with("hls", () => new HlsPlayer(videoElement))
    .exhaustive();
