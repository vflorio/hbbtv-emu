import App, { type UIConfig } from "@hbb-emu/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const render = (config: UIConfig) =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App config={config} />
    </StrictMode>,
  );

const noop: any = () => void 0;

const onLoad = () =>
  render({
    api: {
      channel: {
        load: noop,
        save: noop,
        remove: noop,
        streamEvent: {
          load: noop,
          save: noop,
          remove: noop,
        },
      },
    },
  });

const initialize = () => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onLoad);
  } else {
    onLoad();
  }
};

initialize();
