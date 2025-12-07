import type { ChannelTriplet } from "@hbb-emu/core";

export const generateRandomChannel = (): ChannelTriplet => ({
  onid: Math.floor(Math.random() * 65535),
  tsid: Math.floor(Math.random() * 65535),
  sid: Math.floor(Math.random() * 65535),
});
