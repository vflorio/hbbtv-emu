import { Control, createLogger } from "@hbb-emu/core";
import { AVVideoObjectBase } from "./avVideoObjectBase";

const logger = createLogger("AvVideoMp4");

/**
 * A/V Control object for MP4 video playback.
 *
 * Implements the video/mp4 MIME type for HbbTV applications.
 *
 * @see Control.VideoMp4
 */
export class AvVideoMp4 extends AVVideoObjectBase {
  static readonly MIME_TYPE = Control.VideoMp4.MIME_TYPE;

  constructor() {
    super();
    logger.info("initialized")();
  }
}
