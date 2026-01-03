import { createLogger } from "@hbb-emu/core";
import { BackgroundService } from "@hbb-emu/extension-runtime";

const logger = createLogger("ChromeV3:Background");

const backgroundService = new BackgroundService(
  {
    manifestVersion: 3,
  },
  logger,
);

// Initialize the service
backgroundService
  .init()()
  .catch((error) => {
    logger.error("Failed to initialize BackgroundService", error);
  });

logger.info("Chrome V3 Background Script initialized");

// Export for potential external access
export { backgroundService };
