import { createLogger } from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf";
import { VideoBroadcastWithBackend } from "./videoBroadcastWithBackend";

const logger = createLogger("AvVideoBroadcast");

/**
 * Video/Broadcast embedded object implementation.
 *
 * Implements the video/broadcast MIME type for HbbTV applications.
 * Uses the video-backend for unified player management.
 *
 * Provides channel tuning, EPG access, and component selection.
 */
export class AvVideoBroadcast extends VideoBroadcastWithBackend {
  static readonly MIME_TYPE = OIPF.DAE.broadcast.MIME_TYPE;

  constructor() {
    super();
    logger.info("initialized")();
  }
}
