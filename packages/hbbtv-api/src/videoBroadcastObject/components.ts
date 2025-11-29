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

export namespace Components {
  export interface Contract {
    readonly COMPONENT_TYPE_VIDEO: ComponentType;
    readonly COMPONENT_TYPE_AUDIO: ComponentType;
    readonly COMPONENT_TYPE_SUBTITLE: ComponentType;

    onSelectedComponentChanged?: OnSelectedComponentChanged;
    onComponentChanged?: OnComponentChanged;

    getComponents: GetComponents;
    getCurrentActiveComponents: GetCurrentActiveComponents;
    selectComponent: SelectComponent;
    unselectComponent: UnselectComponent;
    dispatchComponentChange: DispatchComponentChange;
  }

  export type OnSelectedComponentChanged = (componentType?: ComponentType) => void;
  export type OnComponentChanged = (componentType?: ComponentType) => void;
  export type GetComponents = (componentType?: ComponentType) => Collection<AVComponent> | null;
  export type GetCurrentActiveComponents = (componentType?: ComponentType) => Collection<AVComponent> | null;
  export type SelectComponent = (component: AVComponent | ComponentType) => void;
  export type UnselectComponent = (component: AVComponent | ComponentType) => void;
  export type DispatchComponentChange = (componentType?: ComponentType) => void;
}

const logger = createLogger("VideoBroadcast/Components");

export const WithComponents = <T extends ClassType<Playback.Contract>>(Base: T) =>
  class extends Base implements Components.Contract {
    readonly COMPONENT_TYPE_VIDEO = ComponentType.VIDEO;
    readonly COMPONENT_TYPE_AUDIO = ComponentType.AUDIO;
    readonly COMPONENT_TYPE_SUBTITLE = ComponentType.SUBTITLE;

    onSelectedComponentChanged?: Components.OnSelectedComponentChanged;
    onComponentChanged?: Components.OnComponentChanged;

    dispatchComponentChange: Components.DispatchComponentChange = (componentType?) => {
      this.onSelectedComponentChanged?.(componentType);
    };

    getComponents: Components.GetComponents = (_componentType?) =>
      pipe(
        logger.info("getComponents"),
        IO.map(() => (this.playState === PlayState.PRESENTING ? createEmptyCollection<AVComponent>() : null)),
      )();

    getCurrentActiveComponents: Components.GetCurrentActiveComponents = (_componentType?) =>
      pipe(
        logger.info("getCurrentActiveComponents"),
        IO.map(() => (this.playState === PlayState.PRESENTING ? createEmptyCollection<AVComponent>() : null)),
      )();

    selectComponent: Components.SelectComponent = (component) => {
      const componentType = typeof component === "number" ? component : component.type;

      pipe(
        logger.info(`selectComponent(${typeof component === "number" ? ComponentType[component] : "AVComponent"})`),
        IO.flatMap(() => () => this.dispatchComponentChange(componentType)),
      )();
    };

    unselectComponent: Components.UnselectComponent = (component) => {
      const componentType = typeof component === "number" ? component : component.type;

      pipe(
        logger.info(`unselectComponent(${typeof component === "number" ? ComponentType[component] : "AVComponent"})`),
        IO.flatMap(() => () => this.dispatchComponentChange(componentType)),
      )();
    };
  };
