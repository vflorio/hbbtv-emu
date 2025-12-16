import type { ClassType } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";
import type { VideoBroadcastEnv } from ".";

export interface VolumeAPI {
  // State
  _volume: number;
  _muted: boolean;
  // Methods
  setVolume: OIPF.DAE.Broadcast.VideoBroadcast["setVolume"];
  getVolume: OIPF.DAE.Broadcast.VideoBroadcast["getVolume"];
}

export const WithVolume = <T extends ClassType<VideoBroadcastEnv>>(Base: T) =>
  class extends Base implements VolumeAPI {
    _volume = 100;
    _muted = false;

    setVolume = (volume: number): boolean => {
      this.env.setVolume(volume)();
      return true;
    };

    getVolume = (): number => {
      return this.env.getVolume();
    };
  };
