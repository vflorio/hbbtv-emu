import { type ClassType, createLogger } from "@hbb-emu/core";
import { DEFAULT_BROADCAST_PLAY_STATE, type OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { ObjectVideoStream } from "../../providers/videoStream/objectVideoStream";

const logger = createLogger("VideoBroadcast:StreamEvent");

export interface StreamEventAPI {
  _streamEventListeners: unknown[];
  addStreamEventListener: OIPF.DAE.Broadcast.VideoBroadcast["addStreamEventListener"];
  removeStreamEventListener: OIPF.DAE.Broadcast.VideoBroadcast["removeStreamEventListener"];
}

export const WithStreamEventAPI = <T extends ClassType<ObjectVideoStream>>(Base: T) =>
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
