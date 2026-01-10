import { Logger } from "@hbb-emu/core";
import { BackgroundService, createServiceEnv } from "@hbb-emu/extension-runtime";

const backgroundService = new BackgroundService(
  createServiceEnv(
    {
      manifest: 3,
      engine: "chrome",
      storageKey: "hbbtv_emu",
    },
    new Logger("Chrome-V3"),
  ),
);

backgroundService.init()();
