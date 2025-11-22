import type { Programme } from "../channels";
import { type ClassType, type Collection, createEmptyCollection } from "@hbb-emu/lib";

export interface Programmes {
  programmes: Collection<Programme>;
  onProgrammesChanged?: () => void;
}

export const WithProgrammes = <T extends ClassType>(Base: T) =>
  class extends Base implements Programmes {
    onProgrammesChanged?: () => void;

    get programmes(): Collection<Programme> {
      return createEmptyCollection();
    }
  };
