import { Logger } from "@hbb-emu/core";
import { BackgroundService, createServiceEnv } from "@hbb-emu/extension-runtime";

const backgroundService = new BackgroundService(
  createServiceEnv(
    {
      manifest: 2,
      engine: "firefox",
      storageKey: "hbbtv_emu",
    },
    new Logger("Firefox-V2"),
  ),
);

backgroundService.init()();

export { backgroundService };
