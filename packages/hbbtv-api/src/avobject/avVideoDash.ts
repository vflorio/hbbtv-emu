import { Control, createLogger } from "@hbb-emu/core";
import { AVVideoObjectBase } from "./avVideoObjectBase";

const logger = createLogger("AvVideoDash");

/**
 * A/V Control object for DASH video playback.
 *
 * Implements the application/dash+xml MIME type for HbbTV applications.
 * Uses DASH.js
 *
 * @see Control.VideoDash
 */
export class AvVideoDash extends AVVideoObjectBase {
  static readonly MIME_TYPE = Control.VideoDash.MIME_TYPE;

  constructor() {
    super();
    logger.info("initialized")();
  }
}
