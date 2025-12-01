import { type ClassType, type Collection, createEmptyCollection, type Programme } from "@hbb-emu/lib";

export type OnProgrammesChanged = () => void;

export interface Programmes {
  programmes: Collection<Programme>;
  onProgrammesChanged?: OnProgrammesChanged;
}

export const WithProgrammes = <T extends ClassType>(Base: T) =>
  class extends Base implements Programmes {
    onProgrammesChanged?: OnProgrammesChanged;

    get programmes(): Collection<Programme> {
      return createEmptyCollection();
    }
  };
