import type { ChannelTriplet } from "./hbbtv";

export namespace Config {
  export type StreamEvent = {
    id: string;
    name: string;
    eventName: string;
    data: string;
    text?: string;
    targetURL?: string;
    cronSchedule?: string;
    enabled?: boolean;
  };

  export type Channel = ChannelTriplet & {
    id: string;
    name: string;
    mp4Source: string;
    streamEvents?: StreamEvent[];
    enableStreamEvents?: boolean;
  };
}
