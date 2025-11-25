import type { Config } from "@hbb-emu/lib";
import { createContext, useContext } from "react";

export interface UIConfig {
  api: {
    channel: {
      load: () => Promise<Config.Channel[]>;
      save: (channel: Config.Channel) => Promise<void>;
      remove: (id: string) => Promise<void>;
      streamEvent: {
        load: () => Promise<Config.StreamEvent[]>;
        save: (event: Config.StreamEvent) => Promise<void>;
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
