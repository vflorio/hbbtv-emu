import { DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import { Settings } from "@hbb-emu/settings-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Settings
      sideEffects={{
        load: async () => DEFAULT_EXTENSION_STATE,
        save: async () => {},
        playChannel: async () => {},
        dispatchKey: async () => {},
        subscribe: () => () => {},
      }}
    />
  </StrictMode>,
);
