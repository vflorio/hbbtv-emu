import { createLogger } from "@hbb-emu/core";
import { VideoBackend } from "../videoBackend";

const logger = createLogger("AvVideoBroadcast");

export class AvVideoBroadcast extends VideoBackend {
  constructor() {
    super();
    logger.info("initialized")();
  }
}
