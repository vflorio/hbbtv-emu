import { createLogger } from "@hbb-emu/core";
import { BackgroundService, createServiceEnv } from "@hbb-emu/extension-runtime";

const logger = createLogger("Chrome:Background");

const backgroundService = new BackgroundService(
  createServiceEnv(
    {
      manifest: 3,
      engine: "chrome",
      storageKey: "hbbtv_emu",
    },
    logger,
  ),
);

backgroundService
  .init()()
  .catch((error) => {
    logger.error("Initialization failed: ", error);
  });

logger.info("initialized");

export { backgroundService };
