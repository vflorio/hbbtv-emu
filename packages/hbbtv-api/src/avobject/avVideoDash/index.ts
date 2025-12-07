import { createLogger } from "@hbb-emu/core";
import { VideoBackend } from "../videoBackend";

const logger = createLogger("AvVideoDash");

export class AvVideoDash extends VideoBackend {
  constructor() {
    super();
    logger.info("initialized")();
  }
}
