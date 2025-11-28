import type { ExtensionConfig } from "@hbb-emu/lib";
import { configContextError } from "@hbb-emu/lib";
import { createContext, useContext } from "react";

export interface UIConfig {
  channel: {
    load: () => Promise<ExtensionConfig.Channel[]>;
    upsert: (channel: ExtensionConfig.Channel) => Promise<void>;
    remove: (id: string) => Promise<void>;
    play: (channel: ExtensionConfig.Channel) => Promise<void>;
    streamEvent: {
      load: () => Promise<ExtensionConfig.StreamEvent[]>;
      upsert: (event: ExtensionConfig.StreamEvent) => Promise<void>;
      remove: (id: string) => Promise<void>;
    };
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
