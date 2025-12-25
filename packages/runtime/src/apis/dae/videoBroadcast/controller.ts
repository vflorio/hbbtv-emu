import { type ClassType, createLogger } from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf";
import { VideoStreamPlayState } from "../../../subsystems";
import type { VideoBroadcastEnv } from ".";
import type { ChannelAPI } from "./channel";

const logger = createLogger("VideoBroadcast:Controller");

export const WithController = <T extends ClassType<VideoBroadcastEnv & ChannelAPI>>(Base: T) =>
  class extends Base {
    constructor(...args: any[]) {
      super(...args);

      this.env.onStreamStateChange((streamState: VideoStreamPlayState) => {
        const broadcastState = mapStreamToVideoBroadcast(streamState);
        this.setPlayState(broadcastState);

        // Handle channel change success when presenting
        if (streamState === VideoStreamPlayState.PLAYING && this._currentChannel) {
          this.env.eventHandlers.onChannelChangeSucceeded(this._currentChannel);
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

const mapStreamToVideoBroadcast = (state: VideoStreamPlayState): OIPF.DAE.Broadcast.PlayState => {
  switch (state) {
    case VideoStreamPlayState.IDLE:
      return OIPF.DAE.Broadcast.PlayState.UNREALIZED;
    case VideoStreamPlayState.CONNECTING:
    case VideoStreamPlayState.BUFFERING:
      return OIPF.DAE.Broadcast.PlayState.CONNECTING;
    case VideoStreamPlayState.PLAYING:
    case VideoStreamPlayState.PAUSED: // VideoBroadcast doesn't have PAUSED, treat as PRESENTING
      return OIPF.DAE.Broadcast.PlayState.PRESENTING;
    case VideoStreamPlayState.STOPPED:
    case VideoStreamPlayState.FINISHED:
    case VideoStreamPlayState.ERROR:
      return OIPF.DAE.Broadcast.PlayState.STOPPED;
    default:
      return OIPF.DAE.Broadcast.PlayState.STOPPED;
  }
};
