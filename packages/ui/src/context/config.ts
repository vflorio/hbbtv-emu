import type { ChannelConfig, StreamEventConfig } from "@hbb-emu/lib";
import { createContext, useContext } from "react";

export interface UIConfig {
  api: {
    channel: {
      saveChannel: (channel: ChannelConfig) => Promise<void>;
      deleteChannel: (id: string) => Promise<void>;
      loadChannels: () => Promise<ChannelConfig[]>;
    };
    streamEvent: {
      loadStreamEvents: () => Promise<StreamEventConfig[]>;
      saveStreamEvent: (event: StreamEventConfig) => Promise<void>;
      deleteStreamEvent: (id: string) => Promise<void>;
      dispatchStreamEvent: (event: StreamEventConfig) => Promise<void>;
    };
  };
}

const ConfigContext = createContext<UIConfig>({} as UIConfig);

export const ConfigProvider = ConfigContext.Provider;

export const useConfig = (): UIConfig => {
  const context = useContext(ConfigContext);

  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }

  return context;
};
