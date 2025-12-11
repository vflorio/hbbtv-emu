import type { OIPF } from "@hbb-emu/oipf";

export const generateRandomChannel = (): Partial<OIPF.DAE.Broadcast.Channel> => ({
  onid: Math.floor(Math.random() * 65535),
  tsid: Math.floor(Math.random() * 65535),
  sid: Math.floor(Math.random() * 65535),
});
