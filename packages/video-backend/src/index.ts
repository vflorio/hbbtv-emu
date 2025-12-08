/**
 * Video Backend Package
 *
 * Provides a unified video playback abstraction that works across
 * different HbbTV APIs (AVControl and VideoBroadcast) and different
 * streaming technologies (native HTML5, DASH.js, HLS.js).
 *
 * @example
 * ```typescript
 * import { WithVideoBackend, createDashPlayer } from "@hbb-emu/video-backend";
 *
 * // Using the mixin pattern for HbbTV objects
 * class AvVideoDash extends WithVideoBackend("avControl")(BaseClass) {
 *   play() {
 *     this.loadSource({ url: "https://example.com/video.mpd" })();
 *     this.backendPlay();
 *   }
 * }
 *
 * // Or using players directly
 * const player = createDashPlayer();
 * player.load({ url: "https://example.com/video.mpd" });
 * player.play();
 * ```
 *
 * @packageDocumentation
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  ApiType,
  DrmConfig,
  MediaSource,
  MediaSourceType,
  Player,
  PlayerError,
  PlayerEvent,
  PlayerEventListener,
  PlayerEventType,
} from "./types";

export { UnifiedPlayState } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// State Mapping
// ─────────────────────────────────────────────────────────────────────────────

export type { AVControlPlayState, VideoBroadcastPlayState } from "./stateMapping";

export {
  AVControlPlayState as AVControlPlayStateValues,
  avControlToUnified,
  unifiedToApiState,
  unifiedToAvControl,
  unifiedToVideoBroadcast,
  VideoBroadcastPlayState as VideoBroadcastPlayStateValues,
  videoBroadcastToUnified,
} from "./stateMapping";

// ─────────────────────────────────────────────────────────────────────────────
// Players
// ─────────────────────────────────────────────────────────────────────────────

export { createDashPlayer } from "./dashPlayer";
export { createHlsPlayer } from "./hlsPlayer";
export { createHtmlVideoPlayer } from "./htmlVideoPlayer";

// ─────────────────────────────────────────────────────────────────────────────
// Mixin
// ─────────────────────────────────────────────────────────────────────────────

export type { ApiPlayState, VideoBackendInterface, VideoBackendMixin } from "./withVideoBackend";
export { WithVideoBackend } from "./withVideoBackend";
