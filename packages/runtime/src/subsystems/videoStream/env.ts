import { DASHAdapter, HLSAdapter, NativeAdapter } from "@hbb-emu/player-adapter-web";
import { PlayerRuntime, type PlayerRuntimeConfig } from "@hbb-emu/player-runtime";
import { match } from "ts-pattern";
import type { Player, PlayerSourceType } from "./players";
import { PlayerRuntimePlayer } from "./players/runtime";

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

const createPlayer = (sourceType: PlayerSourceType, videoElement?: HTMLVideoElement): Player => {
  const video = videoElement ?? document.createElement("video");

  // Create PlayerRuntime with real adapters
  const config: PlayerRuntimeConfig = {
    adapters: {
      native: new NativeAdapter(),
      hls: new HLSAdapter(),
      dash: new DASHAdapter(),
    },
  };

  const runtime = new PlayerRuntime(config);
  runtime.mount(video)();

  return new PlayerRuntimePlayer(runtime, video, sourceType);
};
