import { type ClassType, createLogger } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";
import type { VideoBroadcastEnv } from ".";

const logger = createLogger("VideoBroadcast:StreamEvent");

export interface StreamEventAPI {
  _streamEventListeners: unknown[];
  addStreamEventListener: OIPF.DAE.Broadcast.VideoBroadcast["addStreamEventListener"];
  removeStreamEventListener: OIPF.DAE.Broadcast.VideoBroadcast["removeStreamEventListener"];
}

export const WithStreamEvent = <T extends ClassType<VideoBroadcastEnv>>(Base: T) =>
  class extends Base implements StreamEventAPI {
    _streamEventListeners: unknown[] = [];

    addStreamEventListener = (
      _targetURL: string,
      _eventName: string,
      _listener: OIPF.DAE.Broadcast.StreamEventListener,
    ): void => {
      logger.debug("addStreamEventListener")();
      // TODO: Implement DSM-CC stream events
    };

    removeStreamEventListener = (
      _targetURL: string,
      _eventName: string,
      _listener: OIPF.DAE.Broadcast.StreamEventListener,
    ): void => {
      logger.debug("removeStreamEventListener")();
      // TODO: Implement
    };
  };
