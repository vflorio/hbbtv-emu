import App, { type ChannelConfig, type Config } from "@hbb-emu/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createStorage } from "./storage";

const render = (config: Config) =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App config={config} />
    </StrictMode>,
  );

const [loadChannels, , saveChannel, deleteChannel] = createStorage<ChannelConfig>("hbbtv-emu_channels");

const onLoad = () =>
  render({
    api: {
      channel: {
        loadChannels,
        saveChannel,
        deleteChannel,
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
