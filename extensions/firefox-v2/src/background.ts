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

// The toolbar button opens and closes the settings UI in the sidebar.
browser.browserAction.onClicked.addListener(() => {
  void browser.sidebarAction.toggle();
});

export { backgroundService };
