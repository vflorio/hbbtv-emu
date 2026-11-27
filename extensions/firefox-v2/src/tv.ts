/**
 * The TV page (Firefox MV2): a channel without application, shown by a TV in TV mode.
 */
import { createAssetsAdapter, createExtensionChannel, createUiClient, startTvShell } from "@hbb-emu/extension-runtime";
import type { UiRequest } from "@hbb-emu/protocol";

const client = createUiClient(
  createExtensionChannel<UiRequest>({ engine: "firefox", manifest: 2, storageKey: "hbbtv_emu" }),
);

void startTvShell({
  document,
  search: location.search,
  getState: client.getState,
  assetUrl: createAssetsAdapter().url,
})();
