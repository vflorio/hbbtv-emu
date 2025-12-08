/**
 * Video Backend Package
 *
 * Provides a unified low-level video playback abstraction that works across
 * different streaming technologies (native HTML5, DASH.js, HLS.js).
 *
 * This package handles only video management - no HbbTV-specific API logic.
 * HbbTV state mapping should be done in the consuming classes.
 *
 * @example
 * ```typescript
 * import { WithVideoBackend, createDashPlayer, UnifiedPlayState } from "@hbb-emu/video-backend";
 *
 * // Using the mixin pattern
 * class AvVideoMp4 extends WithVideoBackend(BaseClass) {
 *   constructor() {
 *     super();
 *     this.onUnifiedStateChange((state) => {
 *       // Map unified state to HbbTV-specific state here
 *     });
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
// Players
// ─────────────────────────────────────────────────────────────────────────────

export { createDashPlayer } from "./players/dash";
export { createHlsPlayer } from "./players/hls";
export { createHtmlVideoPlayer } from "./players/htmlVideo";

// ─────────────────────────────────────────────────────────────────────────────
// Mixin
// ─────────────────────────────────────────────────────────────────────────────

export type { VideoBackendInterface, VideoBackendMixin } from "./withVideoBackend";
export { WithVideoBackend } from "./withVideoBackend";
