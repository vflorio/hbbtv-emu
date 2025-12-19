import { type ClassType, createLogger } from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf";
import { PlayerPlayState } from "../../../subsystems";
import type { VideoBroadcastEnv } from ".";
import type { ChannelAPI } from "./channel";

const logger = createLogger("VideoBroadcast:Controller");

export const WithController = <T extends ClassType<VideoBroadcastEnv & ChannelAPI>>(Base: T) =>
  class extends Base {
    constructor(...args: any[]) {
      super(...args);

      this.env.onStreamStateChange((streamState: PlayerPlayState) => {
        const broadcastState = mapStreamToVideoBroadcast(streamState);
        this.setPlayState(broadcastState);

        // Handle channel change success when presenting
        if (streamState === PlayerPlayState.PLAYING && this._currentChannel) {
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

const mapStreamToVideoBroadcast = (state: PlayerPlayState): OIPF.DAE.Broadcast.PlayState => {
  switch (state) {
    case PlayerPlayState.IDLE:
      return OIPF.DAE.Broadcast.PlayState.UNREALIZED;
    case PlayerPlayState.CONNECTING:
    case PlayerPlayState.BUFFERING:
      return OIPF.DAE.Broadcast.PlayState.CONNECTING;
    case PlayerPlayState.PLAYING:
    case PlayerPlayState.PAUSED: // VideoBroadcast doesn't have PAUSED, treat as PRESENTING
      return OIPF.DAE.Broadcast.PlayState.PRESENTING;
    case PlayerPlayState.STOPPED:
    case PlayerPlayState.FINISHED:
    case PlayerPlayState.ERROR:
      return OIPF.DAE.Broadcast.PlayState.STOPPED;
    default:
      return OIPF.DAE.Broadcast.PlayState.STOPPED;
  }
};
