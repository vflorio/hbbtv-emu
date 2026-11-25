/**
 * Bridge entrypoint for Chrome MV3: ISOLATED-world content script at document_start.
 * Relays between the page runtime (DOM channel) and the background (extension messaging).
 */
import { Logger } from "@hbb-emu/core";
import { createExtensionChannel, startBridge } from "@hbb-emu/extension-runtime";
import { createBridgeChannel } from "@hbb-emu/protocol";

startBridge({
  page: createBridgeChannel(document),
  extension: createExtensionChannel({ engine: "chrome", manifest: 3, storageKey: "hbbtv_emu" }),
  logger: new Logger("Chrome-V3 | Bridge"),
})();
