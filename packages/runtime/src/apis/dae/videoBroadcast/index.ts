import { compose, createStatefulMethods, deriveSchema, type OnStateChangeCallback, type Stateful } from "@hbb-emu/core";
import { type OIPF, type VideoBroadcastState, VideoBroadcastStateCodec } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { ChannelRegistryEnv, StreamEventSchedulerApi } from "../../../subsystems";
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
    ChannelVideoStreamEnv & {
      onCurrentChannelChange: SetCurrentChannelCallback;
      streamEventScheduler: StreamEventSchedulerApi;
      defaults: VideoBroadcastDefaults;
    };
}>;

class BaseVideoBroadcast implements VideoBroadcastEnv {
  readonly env: ChannelRegistryEnv &
    ChannelVideoStreamEnv & {
      onCurrentChannelChange: SetCurrentChannelCallback;
      streamEventScheduler: StreamEventSchedulerApi;
      defaults: VideoBroadcastDefaults;
    };

  constructor(env: {
    channelRegistry: ChannelRegistryEnv;
    videoStream: ChannelVideoStreamEnv;
    onCurrentChannelChange: SetCurrentChannelCallback;
    streamEventScheduler: StreamEventSchedulerApi;
    defaults: VideoBroadcastDefaults;
  }) {
    this.env = {
      ...env.channelRegistry,
      ...env.videoStream,
      onCurrentChannelChange: env.onCurrentChannelChange,
      streamEventScheduler: env.streamEventScheduler,
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

  applyState = (state: Partial<VideoBroadcastState>): IO.IO<void> =>
    pipe(
      this.stateful.applyState(state),
      IO.tap(() => {
        const propagateCurrentChannel: IO.IO<void> = () => {
          // When state sets currentChannel directly, propagate side-effects
          // that would normally be triggered by setChannel().
          if (!("currentChannel" in state)) return;
          const channel = this.currentChannel;
          this.env.onCurrentChannelChange(channel);
          this.env.streamEventScheduler.setCurrentChannel(channel)();
        };

        return propagateCurrentChannel;
      }),
    );

  getState: IO.IO<Partial<VideoBroadcastState>> = this.stateful.getState;

  subscribe = (callback: OnStateChangeCallback<VideoBroadcastState>): IO.IO<() => void> =>
    this.stateful.subscribe(callback);

  notifyStateChange = (changedKeys: ReadonlyArray<keyof VideoBroadcastState>): IO.IO<void> =>
    this.stateful.notifyStateChange(changedKeys);
}
