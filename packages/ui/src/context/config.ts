import { createContext, useContext } from "react";

export interface ChannelConfig {
  id: string;
  name: string;
  ccid: string;
  onid: string;
  tsid: string;
  sid: string;
  mp4Source: string;
}

export interface Config {
  api: {
    channel: {
      saveChannel: (channel: ChannelConfig) => Promise<void>;
      deleteChannel: (id: string) => Promise<void>;
      loadChannels: () => Promise<ChannelConfig[]>;
    };
  };
}

const ConfigContext = createContext<Config>({} as Config);

export const ConfigProvider = ConfigContext.Provider;

export const useConfig = (): Config => {
  const context = useContext(ConfigContext);

  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }

  return context;
};
