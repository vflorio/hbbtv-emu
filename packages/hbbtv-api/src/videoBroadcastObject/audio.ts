import { type Constructor, logger } from "../utils";

interface WithAudio {
  setVolume(volume: number): boolean;
  getVolume(): number;
}

const log = logger("Audio");

export const WithAudio = <T extends Constructor>(Base: T) =>
  class extends Base implements WithAudio {
    volume = 100;

    setVolume(volume: number): boolean {
      log(`setVolume(${volume})`);

      if (volume < 0 || volume > 100) {
        return false;
      }

      const changed = this.volume !== volume;
      this.volume = volume;
      return changed;
    }

    getVolume(): number {
      log("getVolume");
      return this.volume;
    }
  };
