import type { ChannelTriplet } from "@hbb-emu/lib";

export const generateRandomChannel = (): ChannelTriplet => ({
  onid: Math.floor(Math.random() * 65535),
  tsid: Math.floor(Math.random() * 65535),
  sid: Math.floor(Math.random() * 65535),
});
