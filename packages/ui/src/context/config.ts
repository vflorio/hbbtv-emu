import type { ExtensionConfig } from "@hbb-emu/lib";
import { createContext, useContext } from "react";

export interface UIConfig {
  channel: {
    load: () => Promise<ExtensionConfig.Channel[]>;
    save: (channel: ExtensionConfig.Channel) => Promise<void>;
    remove: (id: string) => Promise<void>;
    streamEvent: {
      load: () => Promise<ExtensionConfig.StreamEvent[]>;
      save: (event: ExtensionConfig.StreamEvent) => Promise<void>;
      remove: (id: string) => Promise<void>;
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
