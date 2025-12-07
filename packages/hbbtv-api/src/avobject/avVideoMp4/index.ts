import { createLogger } from "@hbb-emu/core";
import { VideoBackend } from "../videoBackend";

const logger = createLogger("AvVideoMp4");

export class AvVideoMp4 extends VideoBackend {
  constructor() {
    super();
    logger.info("initialized")();
  }
}
