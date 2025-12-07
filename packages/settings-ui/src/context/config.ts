import type { ExtensionConfig } from "@hbb-emu/core";
import { configContextError } from "@hbb-emu/core";
import { createContext, useContext } from "react";

export interface UIConfig {
  channel: {
    load: () => Promise<ExtensionConfig.ChannelConfig[]>;
    upsert: (channel: ExtensionConfig.ChannelConfig) => Promise<void>;
    remove: (id: string) => Promise<void>;
    play: (channel: ExtensionConfig.ChannelConfig) => Promise<void>;
    streamEvent: {
      load: () => Promise<ExtensionConfig.StreamEventConfig[]>;
      upsert: (event: ExtensionConfig.StreamEventConfig) => Promise<void>;
      remove: (id: string) => Promise<void>;
    };
  };
  common: {
    load: () => Promise<Omit<ExtensionConfig.State, "channels">>;
    save: (config: Omit<ExtensionConfig.State, "channels">) => Promise<void>;
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
