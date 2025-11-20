import type { Programme } from "../channels";
import { type Collection, type ClassType, createEmptyCollection } from "../utils";

interface WithProgrammes {
  programmes: Collection<Programme>;
  onProgrammesChanged?: () => void;
}

export const WithProgrammes = <T extends ClassType>(Base: T) =>
  class extends Base implements WithProgrammes {
    onProgrammesChanged?: () => void;

    get programmes(): Collection<Programme> {
      return createEmptyCollection();
    }
  };
