import type { ChannelConfig, ExtensionState, StreamEventConfig } from "@hbb-emu/core";
import { configContextError } from "@hbb-emu/core";
import { createContext, useContext } from "react";

export interface UIConfig {
  channel: {
    load: () => Promise<ChannelConfig[]>;
    upsert: (channel: ChannelConfig) => Promise<void>;
    remove: (id: string) => Promise<void>;
    play: (channel: ChannelConfig) => Promise<void>;
    streamEvent: {
      load: () => Promise<StreamEventConfig[]>;
      upsert: (event: StreamEventConfig) => Promise<void>;
      remove: (id: string) => Promise<void>;
    };
  };
  common: {
    load: () => Promise<Omit<ExtensionState, "channels">>;
    save: (config: Omit<ExtensionState, "channels">) => Promise<void>;
  };
}

const ConfigContext = createContext<UIConfig>({} as UIConfig);

export const ConfigProvider = ConfigContext.Provider;

export const useConfig = (): UIConfig => {
  const context = useContext(ConfigContext);

  if (!context) {
    throw configContextError("useConfig must be used within a ConfigProvider");
  }

  return context;
};
