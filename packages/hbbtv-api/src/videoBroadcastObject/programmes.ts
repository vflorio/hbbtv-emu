import { type ClassType, type Collection, createEmptyCollection, type Programme } from "@hbb-emu/lib";

export namespace Programmes {
  export interface Contract {
    programmes: Collection<Programme>;
    onProgrammesChanged?: OnProgrammesChanged;
  }

  export type OnProgrammesChanged = () => void;
}

export const WithProgrammes = <T extends ClassType>(Base: T) =>
  class extends Base implements Programmes.Contract {
    onProgrammesChanged?: Programmes.OnProgrammesChanged;

    get programmes(): Collection<Programme> {
      return createEmptyCollection();
    }
  };
