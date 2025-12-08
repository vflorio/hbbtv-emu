import { Control, createLogger } from "@hbb-emu/core";
import { AVObjectWithBackend } from "./avObjectWithBackend";

const logger = createLogger("AvVideoMp4");

/**
 * A/V Control object for MP4 video playback.
 *
 * Implements the video/mp4 MIME type for HbbTV applications.
 * Uses the video-backend for unified player management.
 *
 * @see Control.VideoMp4
 */
export class AvVideoMp4 extends AVObjectWithBackend {
  static readonly MIME_TYPE = Control.VideoMp4.MIME_TYPE;

  constructor() {
    super();
    // MP4 uses native HTML5 video player (default)
    logger.info("initialized")();
  }
}
