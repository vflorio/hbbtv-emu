import { compose, createStatefulMethods, deriveSchema, type OnStateChangeCallback, type Stateful } from "@hbb-emu/core";
import { type OIPF, type VideoBroadcastState, VideoBroadcastStateCodec } from "@hbb-emu/oipf";
import type * as IO from "fp-ts/IO";
import type { ChannelRegistryEnv } from "../../providers";
import { ObjectVideoStream } from "../../providers/videoStream/videoStream";
import { type ChannelVideoStreamEnv, WithChannel } from "./channel";
import { WithComponent } from "./component";
import { WithController } from "./controller";
import { WithDisplay } from "./display";
import { WithMisc } from "./misc";
import { WithStreamEvent } from "./streamEvent";
import { WithVolume } from "./volume";

export type VideoBroadcastEnv = ObjectVideoStream &
  Readonly<{
    env: ChannelRegistryEnv & ChannelVideoStreamEnv;
  }>;

class BaseVideoBroadcast extends ObjectVideoStream implements VideoBroadcastEnv {
  readonly env: ChannelRegistryEnv & ChannelVideoStreamEnv;

  constructor(env: { channelRegistry: ChannelRegistryEnv; videoStream: ChannelVideoStreamEnv }) {
    super();

    this.env = {
      ...env.channelRegistry,
      ...env.videoStream,
    };
  }
}

class VideoBroadcastAPI
  extends compose(
    BaseVideoBroadcast,
    WithChannel,
    WithComponent,
    WithDisplay,
    WithVolume,
    WithStreamEvent,
    WithMisc,
    WithController,
  )
  implements OIPF.DAE.Broadcast.VideoBroadcast {}

export class VideoBroadcast extends VideoBroadcastAPI implements Stateful<VideoBroadcastState> {
  readonly stateful = createStatefulMethods(
    deriveSchema<VideoBroadcastState, VideoBroadcastAPI>(VideoBroadcastStateCodec, {
      mappings: {
        playState: "_playState",
        fullScreen: "_fullScreen",
        width: "_width",
        height: "_height",
        currentChannel: "_currentChannel",
        programmes: "_programmes",
        volume: "_volume",
        muted: "_muted",
        components: "_components",
        selectedComponents: "_selectedComponents",
        streamEventListeners: "_streamEventListeners",
      },
    }),
    this,
  );

  applyState = (state: Partial<VideoBroadcastState>): IO.IO<void> => this.stateful.applyState(state);

  getState = (): IO.IO<Partial<VideoBroadcastState>> => this.stateful.getState();

  subscribe = (callback: OnStateChangeCallback<VideoBroadcastState>): IO.IO<() => void> =>
    this.stateful.subscribe(callback);

  notifyStateChange = (changedKeys: ReadonlyArray<keyof VideoBroadcastState>): IO.IO<void> =>
    this.stateful.notifyStateChange(changedKeys);
}
