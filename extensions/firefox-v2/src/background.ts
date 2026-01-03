import { createLogger } from "@hbb-emu/core";
import { BackgroundService } from "@hbb-emu/extension-runtime";

const logger = createLogger("Firefox:Background");

const backgroundService = new BackgroundService(
  {
    manifestVersion: 2,
  },
  logger,
);

// Initialize the service
backgroundService
  .init()()
  .catch((error) => {
    logger.error("Failed to initialize BackgroundService", error);
  });

logger.info("Firefox Background Script initialized");

// Export for potential external access
export { backgroundService };
