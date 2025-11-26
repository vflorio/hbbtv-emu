import { type ClassType, createLogger } from "@hbb-emu/lib";

export interface Audio {
  setVolume(volume: number): boolean;
  getVolume(): number;
}

const logger = createLogger("Audio");

export const WithAudio = <T extends ClassType>(Base: T) =>
  class extends Base implements Audio {
    volume = 100;

    setVolume = (volume: number): boolean => {
      logger.log(`setVolume(${volume})`);

      if (volume < 0 || volume > 100) {
        return false;
      }

      const changed = this.volume !== volume;
      this.volume = volume;
      return changed;
    };

    getVolume = (): number => {
      logger.log("getVolume");
      return this.volume;
    };
  };
