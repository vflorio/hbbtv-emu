import type { Programme } from "../channels";
import { type Collection, type Constructor, createEmptyCollection } from "../utils";

interface WithProgrammes {
  programmes: Collection<Programme>;
  onProgrammesChanged?: () => void;
}

export const WithProgrammes = <T extends Constructor>(Base: T) =>
  class extends Base implements WithProgrammes {
    onProgrammesChanged?: () => void;

    get programmes(): Collection<Programme> {
      return createEmptyCollection();
    }
  };
