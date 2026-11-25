/**
 * Settings UI (sidebar) for Firefox MV2: the shared settings app, wired to the
 * background through the UI client.
 */
import { createExtensionChannel, createUiClient } from "@hbb-emu/extension-runtime";
import type { UiRequest } from "@hbb-emu/protocol";
import { Settings, type SideEffects } from "@hbb-emu/settings-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const client = createUiClient(
  createExtensionChannel<UiRequest>({ engine: "firefox", manifest: 2, storageKey: "hbbtv_emu" }),
);

const sideEffects: SideEffects = {
  load: client.getState,
  save: client.saveState,
  subscribe: client.subscribe,
  playChannel: client.playChannel,
  dispatchKey: client.dispatchKey,
};

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Settings sideEffects={sideEffects} />
    </StrictMode>,
  );
}
