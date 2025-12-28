import { type ClassType, createLogger } from "@hbb-emu/core";
import { OIPF } from "@hbb-emu/oipf";
import {
  isBuffering,
  isConnecting,
  isError,
  isFinished,
  isIdle,
  isPaused,
  isPlaying,
  isStopped,
  type VideoStreamPlayState,
} from "../../../subsystems";
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
        if (isPlaying(streamState) && this._currentChannel) {
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
  if (isIdle(state)) return OIPF.DAE.Broadcast.PlayState.UNREALIZED;
  if (isConnecting(state)) return OIPF.DAE.Broadcast.PlayState.CONNECTING;
  if (isBuffering(state)) return OIPF.DAE.Broadcast.PlayState.CONNECTING;
  if (isPlaying(state)) return OIPF.DAE.Broadcast.PlayState.PRESENTING;
  if (isPaused(state)) return OIPF.DAE.Broadcast.PlayState.PRESENTING;
  if (isStopped(state)) return OIPF.DAE.Broadcast.PlayState.STOPPED;
  if (isFinished(state)) return OIPF.DAE.Broadcast.PlayState.STOPPED;
  if (isError(state)) return OIPF.DAE.Broadcast.PlayState.STOPPED;
  return OIPF.DAE.Broadcast.PlayState.STOPPED;
};
