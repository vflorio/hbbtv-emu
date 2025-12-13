import { type ClassType, createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";

const logger = createLogger("VideoBroadcast:Component");

export interface ComponentAPI {
  // State
  _selectedComponents: Record<string, unknown>;
  _components: unknown[];

  // Constants (COMPONENT_TYPE_*)
  readonly COMPONENT_TYPE_VIDEO: OIPF.DAE.Broadcast.VideoBroadcast["COMPONENT_TYPE_VIDEO"];
  readonly COMPONENT_TYPE_AUDIO: OIPF.DAE.Broadcast.VideoBroadcast["COMPONENT_TYPE_AUDIO"];
  readonly COMPONENT_TYPE_SUBTITLE: OIPF.DAE.Broadcast.VideoBroadcast["COMPONENT_TYPE_SUBTITLE"];
  // Events
  onSelectedComponentChanged: OIPF.DAE.Broadcast.VideoBroadcast["onSelectedComponentChanged"];
  onComponentChanged: OIPF.DAE.Broadcast.VideoBroadcast["onComponentChanged"];
  // Methods
  getComponents: OIPF.DAE.Broadcast.VideoBroadcast["getComponents"];
  getCurrentActiveComponents: OIPF.DAE.Broadcast.VideoBroadcast["getCurrentActiveComponents"];
  selectComponent: OIPF.DAE.Broadcast.VideoBroadcast["selectComponent"];
  unselectComponent: OIPF.DAE.Broadcast.VideoBroadcast["unselectComponent"];
}

export const WithComponentAPI = <T extends ClassType>(Base: T) =>
  class extends Base implements ComponentAPI {
    _selectedComponents: Record<string, unknown> = {};
    _components: unknown[] = [];

    readonly COMPONENT_TYPE_VIDEO = 0 as const;
    readonly COMPONENT_TYPE_AUDIO = 1 as const;
    readonly COMPONENT_TYPE_SUBTITLE = 2 as const;

    onSelectedComponentChanged: OIPF.DAE.Broadcast.OnSelectedComponentChangedHandler | null = null;
    onComponentChanged: OIPF.DAE.Broadcast.OnComponentChangedHandler | null = null;

    getComponents = (_componentType?: number | null): undefined => {
      logger.debug("getComponents")();
      // TODO: Implement component management
      return undefined;
    };

    getCurrentActiveComponents = (_componentType?: number): undefined => {
      logger.debug("getCurrentActiveComponents")();
      // TODO: Implement
      return undefined;
    };

    selectComponent = (_component: unknown): void => {
      logger.debug("selectComponent")();
      // TODO: Implement
    };

    unselectComponent = (_component: unknown): void => {
      logger.debug("unselectComponent")();
      // TODO: Implement
    };
  };
