import type { ChannelConfig, StreamEventConfig } from "@hbb-emu/lib";
import { createContext, useContext } from "react";

export interface UIConfig {
  api: {
    channel: {
      load: () => Promise<ChannelConfig[]>;
      save: (channel: ChannelConfig) => Promise<void>;
      remove: (id: string) => Promise<void>;
      streamEvent: {
        load: () => Promise<StreamEventConfig[]>;
        save: (event: StreamEventConfig) => Promise<void>;
        remove: (id: string) => Promise<void>;
      };
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
