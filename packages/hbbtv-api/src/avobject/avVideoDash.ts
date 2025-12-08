import { Control, createLogger } from "@hbb-emu/core";
import { AVObjectWithBackend } from "../backend/avObjectWithBackend";

const logger = createLogger("AvVideoDash");

/**
 * A/V Control object for DASH video playback.
 *
 * Implements the application/dash+xml MIME type for HbbTV applications.
 * Uses the video-backend with DASH.js for adaptive streaming.
 *
 * @see Control.VideoDash
 */
export class AvVideoDash extends AVObjectWithBackend {
  static readonly MIME_TYPE = Control.VideoDash.MIME_TYPE;

  constructor() {
    super();
    // DASH player will be initialized automatically when a .mpd source is loaded
    // via the loadSource() method inherited from AVObjectWithBackend
    logger.info("initialized")();
  }
}
