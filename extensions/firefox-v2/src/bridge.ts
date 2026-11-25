/**
 * Bridge entrypoint for Firefox MV2: content script at document_start.
 * Relays between the page runtime (DOM channel) and the background (extension messaging).
 */
import { Logger } from "@hbb-emu/core";
import { createExtensionChannel, startBridge } from "@hbb-emu/extension-runtime";
import { createBridgeChannel } from "@hbb-emu/protocol";

startBridge({
  page: createBridgeChannel(document),
  extension: createExtensionChannel({ engine: "firefox", manifest: 2, storageKey: "hbbtv_emu" }),
  logger: new Logger("Firefox-V2 | Bridge"),
})();
