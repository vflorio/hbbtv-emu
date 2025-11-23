import App, { type ChannelConfig, type Config, type StreamEventConfig } from "@hbb-emu/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EntryStorage } from "@hbb-emu/lib";

const render = (config: Config) =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App config={config} />
    </StrictMode>,
  );

const channelStorage = new EntryStorage<ChannelConfig>("hbbtv-emu_channels");
const streamEventStorage = new EntryStorage<StreamEventConfig>("hbbtv-emu_stream_events");

const onLoad = () =>
  render({
    api: {
      channel: {
        loadChannels: channelStorage.loadAll,
        saveChannel: channelStorage.saveEntry,
        deleteChannel: channelStorage.deleteEntry,
      },
      streamEvent: {
        loadStreamEvents: streamEventStorage.loadAll,
        saveStreamEvent: streamEventStorage.saveEntry,
        deleteStreamEvent: streamEventStorage.deleteEntry,
        dispatchStreamEvent: async (_event: StreamEventConfig) => { },
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
