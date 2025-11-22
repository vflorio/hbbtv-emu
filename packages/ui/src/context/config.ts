import { createContext, useContext } from "react";

export interface StreamEventConfig {
  id: string;
  name: string;
  eventName: string;
  data: string;
  text?: string;
  targetURL?: string;
  cronSchedule?: string;
  enabled?: boolean;
}

export interface ChannelConfig {
  id: string;
  name: string;
  ccid: string;
  onid: string;
  tsid: string;
  sid: string;
  mp4Source: string;
  streamEvents?: StreamEventConfig[];
  enableStreamEvents?: boolean;
}

export interface Config {
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

const ConfigContext = createContext<Config>({} as Config);

export const ConfigProvider = ConfigContext.Provider;

export const useConfig = (): Config => {
  const context = useContext(ConfigContext);

  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }

  return context;
};
