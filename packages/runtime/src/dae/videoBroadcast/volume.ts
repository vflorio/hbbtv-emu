import type { ClassType } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";
import type { ObjectVideoStream } from "../../providers/videoStream/objectVideoStream";

export interface VolumeAPI {
  // State
  _volume: number;
  _muted: boolean;
  // Methods
  setVolume: OIPF.DAE.Broadcast.VideoBroadcast["setVolume"];
  getVolume: OIPF.DAE.Broadcast.VideoBroadcast["getVolume"];
}

export const WithVolumeAPI = <T extends ClassType<ObjectVideoStream>>(Base: T) =>
  class extends Base implements VolumeAPI {
    _volume = 100;
    _muted = false;

    setVolume = (volume: number): boolean => {
      this.backendSetVolume(volume);
      return true;
    };

    getVolume = (): number => {
      return this.player.volume;
    };
  };
