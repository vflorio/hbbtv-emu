import App, { type ChannelConfig, type Config, type StreamEventConfig } from "@hbb-emu/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createStorage } from "@hbb-emu/lib";

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
      streamEvent: {
        loadStreamEvents: async () => [],
        saveStreamEvent: async (_event) => {},
        deleteStreamEvent: async (_id: string) => {},
        dispatchStreamEvent: async (_event: StreamEventConfig) => {},
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
