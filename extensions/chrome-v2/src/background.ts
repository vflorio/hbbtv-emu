import { Logger } from "@hbb-emu/core";
import { BackgroundService, createServiceEnv } from "@hbb-emu/extension-runtime";

const backgroundService = new BackgroundService(
  createServiceEnv(
    {
      manifest: 2,
      engine: "chrome",
      storageKey: "hbbtv_emu",
    },
    new Logger("Chrome-V2"),
  ),
);

backgroundService.init()();
