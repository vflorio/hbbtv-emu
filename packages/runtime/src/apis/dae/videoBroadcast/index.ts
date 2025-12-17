import { compose, createStatefulMethods, deriveSchema, type OnStateChangeCallback, type Stateful } from "@hbb-emu/core";
import { type OIPF, type VideoBroadcastState, VideoBroadcastStateCodec } from "@hbb-emu/oipf";
import type * as IO from "fp-ts/IO";
import type { ChannelRegistryEnv } from "../../../subsystems";
import { type ChannelVideoStreamEnv, WithChannel } from "./channel";
import { WithComponent } from "./component";
import { WithController } from "./controller";
import { WithDisplay } from "./display";
import { WithMisc } from "./misc";
import { WithStreamEvent } from "./streamEvent";
import { WithVolume } from "./volume";

/**
 * Callback to notify the global current channel provider of channel changes.
 */
export type SetCurrentChannelCallback = (channel: OIPF.DAE.Broadcast.Channel | null) => void;

export type VideoBroadcastDefaults = Readonly<{
  fullScreen: boolean;
  width: number;
  height: number;
  playState: OIPF.DAE.Broadcast.PlayState;
}>;

export type VideoBroadcastEnv = Readonly<{
  env: ChannelRegistryEnv &
    ChannelVideoStreamEnv & { onCurrentChannelChange: SetCurrentChannelCallback; defaults: VideoBroadcastDefaults };
}>;

class BaseVideoBroadcast implements VideoBroadcastEnv {
  readonly env: ChannelRegistryEnv &
    ChannelVideoStreamEnv & { onCurrentChannelChange: SetCurrentChannelCallback; defaults: VideoBroadcastDefaults };

  constructor(env: {
    channelRegistry: ChannelRegistryEnv;
    videoStream: ChannelVideoStreamEnv;
    onCurrentChannelChange: SetCurrentChannelCallback;
    defaults: VideoBroadcastDefaults;
  }) {
    this.env = {
      ...env.channelRegistry,
      ...env.videoStream,
      onCurrentChannelChange: env.onCurrentChannelChange,
      defaults: env.defaults,
    };
  }

  get videoElement(): HTMLVideoElement {
    return this.env.videoElement;
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
