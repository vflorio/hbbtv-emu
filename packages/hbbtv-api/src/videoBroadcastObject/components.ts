import { type Collection, type Constructor, createEmptyCollection, logger } from "../utils";
import type { WithPlayback } from "./playback";
import { PlayState } from "./playback";

export enum ComponentType {
  VIDEO = 0,
  AUDIO = 1,
  SUBTITLE = 2,
}

export interface AVComponent {
  componentTag: number;
  pid: number;
  type: ComponentType;
  encoding: string;
  encrypted: boolean;
  audioChannels?: number;
  audioDescription?: boolean;
  language?: string;
}

interface WithComponents {
  readonly COMPONENT_TYPE_VIDEO: ComponentType;
  readonly COMPONENT_TYPE_AUDIO: ComponentType;
  readonly COMPONENT_TYPE_SUBTITLE: ComponentType;

  onSelectedComponentChanged?: (componentType?: ComponentType) => void;
  onComponentChanged?: (componentType?: ComponentType) => void;

  getComponents(componentType?: ComponentType): Collection<AVComponent> | null;
  getCurrentActiveComponents(componentType?: ComponentType): Collection<AVComponent> | null;
  selectComponent(component: AVComponent | ComponentType): void;
  unselectComponent(component: AVComponent | ComponentType): void;
}

const log = logger("Components");

export const WithComponents = <T extends Constructor<WithPlayback>>(Base: T) =>
  class extends Base implements WithComponents {
    readonly COMPONENT_TYPE_VIDEO = ComponentType.VIDEO;
    readonly COMPONENT_TYPE_AUDIO = ComponentType.AUDIO;
    readonly COMPONENT_TYPE_SUBTITLE = ComponentType.SUBTITLE;

    onSelectedComponentChanged?: (componentType?: ComponentType) => void;
    onComponentChanged?: (componentType?: ComponentType) => void;

    dispatchComponentChange = (componentType?: ComponentType): void => {
      this.onSelectedComponentChanged?.(componentType);
    };

    getComponents = (_componentType?: ComponentType): Collection<AVComponent> | null => {
      log("getComponents");
      return this.playState === PlayState.PRESENTING ? createEmptyCollection() : null;
    };

    getCurrentActiveComponents = (_componentType?: ComponentType): Collection<AVComponent> | null => {
      log("getCurrentActiveComponents");
      return this.playState === PlayState.PRESENTING ? createEmptyCollection() : null;
    };

    selectComponent = (component: AVComponent | ComponentType): void => {
      const componentType = typeof component === "number" ? component : component.type;

      log(`selectComponent(${typeof component === "number" ? ComponentType[component] : "AVComponent"})`);

      this.dispatchComponentChange(componentType);
    }

    unselectComponent = (component: AVComponent | ComponentType): void => {
      const componentType = typeof component === "number" ? component : component.type;

      log(`unselectComponent(${typeof component === "number" ? ComponentType[component] : "AVComponent"})`);

      this.dispatchComponentChange(componentType);
    }
  };
