import type { ChannelTriplet } from "@hbb-emu/hbbtv-api";

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

export type ChannelConfig = ChannelTriplet & {
  id: string;
  name: string;
  mp4Source: string;
  streamEvents?: StreamEventConfig[];
  enableStreamEvents?: boolean;
};
