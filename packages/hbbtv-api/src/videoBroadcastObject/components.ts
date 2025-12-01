import { type ClassType, type Collection, createEmptyCollection, createLogger } from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { Playback } from "./playback";
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

export interface Components {
  readonly COMPONENT_TYPE_VIDEO: ComponentType;
  readonly COMPONENT_TYPE_AUDIO: ComponentType;
  readonly COMPONENT_TYPE_SUBTITLE: ComponentType;

  onSelectedComponentChanged?: (componentType?: ComponentType) => void;
  onComponentChanged?: (componentType?: ComponentType) => void;

  getComponents: (componentType?: ComponentType) => Collection<AVComponent> | null;
  getCurrentActiveComponents: (componentType?: ComponentType) => Collection<AVComponent> | null;
  selectComponent: (component: AVComponent | ComponentType) => void;
  unselectComponent: (component: AVComponent | ComponentType) => void;
  dispatchComponentChange: (componentType?: ComponentType) => void;
}

const logger = createLogger("VideoBroadcast/Components");

export const WithComponents = <T extends ClassType<Playback>>(Base: T) =>
  class extends Base implements Components {
    readonly COMPONENT_TYPE_VIDEO = ComponentType.VIDEO;
    readonly COMPONENT_TYPE_AUDIO = ComponentType.AUDIO;
    readonly COMPONENT_TYPE_SUBTITLE = ComponentType.SUBTITLE;

    onSelectedComponentChanged?: (componentType?: ComponentType) => void;
    onComponentChanged?: (componentType?: ComponentType) => void;

    dispatchComponentChange = (componentType?: ComponentType): void => {
      this.onSelectedComponentChanged?.(componentType);
    };

    getComponents = (_componentType?: ComponentType): Collection<AVComponent> | null =>
      pipe(
        logger.info("getComponents"),
        IO.map(() => (this.playState === PlayState.PRESENTING ? createEmptyCollection<AVComponent>() : null)),
      )();

    getCurrentActiveComponents = (_componentType?: ComponentType): Collection<AVComponent> | null =>
      pipe(
        logger.info("getCurrentActiveComponents"),
        IO.map(() => (this.playState === PlayState.PRESENTING ? createEmptyCollection<AVComponent>() : null)),
      )();

    selectComponent = (component: AVComponent | ComponentType): void => {
      const componentType = typeof component === "number" ? component : component.type;

      pipe(
        logger.info(`selectComponent(${typeof component === "number" ? ComponentType[component] : "AVComponent"})`),
        IO.flatMap(() => () => this.dispatchComponentChange(componentType)),
      )();
    };

    unselectComponent = (component: AVComponent | ComponentType): void => {
      const componentType = typeof component === "number" ? component : component.type;

      pipe(
        logger.info(`unselectComponent(${typeof component === "number" ? ComponentType[component] : "AVComponent"})`),
        IO.flatMap(() => () => this.dispatchComponentChange(componentType)),
      )();
    };
  };
