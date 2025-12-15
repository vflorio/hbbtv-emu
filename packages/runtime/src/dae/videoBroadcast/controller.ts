import { type ClassType, createLogger } from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf";
import { StreamPlayState } from "../../providers";
import type { VideoBroadcastEnv } from ".";
import type { ChannelAPI } from "./channel";

const logger = createLogger("VideoBroadcast:Controller");

export const WithController = <T extends ClassType<VideoBroadcastEnv & ChannelAPI>>(Base: T) =>
  class extends Base {
    constructor(...args: any[]) {
      super(...args);

      this.env.onStreamStateChange((streamState) => {
        const broadcastState = mapStreamToVideoBroadcast(streamState);
        this.setPlayState(broadcastState);

        // Handle channel change success when presenting
        if (streamState === StreamPlayState.PLAYING && this._currentChannel) {
          this.onChannelChangeSucceeded?.(this._currentChannel);
        }
      });

      this.setChannel({
        idType: OIPF.DAE.Broadcast.ChannelIdType.ID_DVB_T2,
        name: "Default Channel",
        onid: 1,
        tsid: 1,
        sid: 1,
      });

      logger.info("Initialized")();
    }
  };

const mapStreamToVideoBroadcast = (state: StreamPlayState): OIPF.DAE.Broadcast.PlayState => {
  switch (state) {
    case StreamPlayState.IDLE:
      return OIPF.DAE.Broadcast.PlayState.UNREALIZED;
    case StreamPlayState.CONNECTING:
    case StreamPlayState.BUFFERING:
      return OIPF.DAE.Broadcast.PlayState.CONNECTING;
    case StreamPlayState.PLAYING:
    case StreamPlayState.PAUSED: // VideoBroadcast doesn't have PAUSED, treat as PRESENTING
      return OIPF.DAE.Broadcast.PlayState.PRESENTING;
    case StreamPlayState.STOPPED:
    case StreamPlayState.FINISHED:
    case StreamPlayState.ERROR:
      return OIPF.DAE.Broadcast.PlayState.STOPPED;
  }
};
