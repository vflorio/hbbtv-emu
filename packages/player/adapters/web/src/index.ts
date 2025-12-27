import type { PlayerEngineEvent } from "@hbb-emu/player-runtime";
import type Hls from "hls.js";

export * from "./dash";
export * from "./hls";
export * from "./native";

export type VideoEventListener = (event: PlayerEngineEvent) => void;

// ============================================================================
// Configuration Types
// ============================================================================

export interface NativeConfig {
  readonly preload?: "none" | "metadata" | "auto";
  readonly crossOrigin?: "anonymous" | "use-credentials";
  readonly autoplay?: boolean;
}

export interface HLSConfig {
  readonly hlsConfig?: Partial<Hls["config"]>;
  readonly startLevel?: number;
  readonly autoStartLoad?: boolean;
  readonly debug?: boolean;
}

export interface DASHConfig {
  readonly dashSettings?: Record<string, unknown>;
  readonly debug?: boolean;
  readonly streaming?: {
    bufferTimeDefault?: number;
    bufferTimeMax?: number;
  };
}

export interface PlaybackConfig {
  readonly native: NativeConfig;
  readonly hls: HLSConfig;
  readonly dash: DASHConfig;
}

// ============================================================================
// Quality/Manifest Types
// ============================================================================

export interface QualityLevel {
  readonly index: number;
  readonly bitrate: number;
  readonly resolution: {
    readonly width: number;
    readonly height: number;
  };
  readonly codec?: string;
}

export interface ManifestInfo {
  readonly duration: number;
  readonly isDynamic: boolean;
  readonly profiles?: string[];
  readonly availableQualities: QualityLevel[];
}
