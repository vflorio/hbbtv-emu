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

export type VideoBroadcastEventHandlers = Readonly<{
  onPlayStateChange: (state: OIPF.DAE.Broadcast.PlayState) => void;
  onFullScreenChange: (fullscreen: boolean) => void;
  onfocus: () => void;
  onblur: () => void;
  onChannelChangeSucceeded: (channel: OIPF.DAE.Broadcast.Channel) => void;
  onChannelChangeError: (channel: OIPF.DAE.Broadcast.Channel, error: number) => void;
  onProgrammesChanged: () => void;
  onParentalRatingChange: (contentId: string, ratings: string[], blocked: boolean) => void;
  onParentalRatingError: (contentId: string, ratings: string[], drmSystemId: string) => void;
  onDRMRightsError: (errorState: string, contentId: string, drmSystemId: string, rightsIssuerUrl: string) => void;
  onSelectedComponentChanged: (componentType: number) => void;
  onComponentChanged: (componentType: number, added: boolean) => void;
}>;

export type VideoBroadcastEnv = Readonly<{
  env: ChannelRegistryEnv &
    ChannelVideoStreamEnv & {
      onCurrentChannelChange: SetCurrentChannelCallback;
      streamEventScheduler: StreamEventSchedulerApi;
      defaults: VideoBroadcastDefaults;
      eventHandlers: VideoBroadcastEventHandlers;
    };
}>;

class BaseVideoBroadcast implements VideoBroadcastEnv {
  readonly env: ChannelRegistryEnv &
    ChannelVideoStreamEnv & {
      onCurrentChannelChange: SetCurrentChannelCallback;
      streamEventScheduler: StreamEventSchedulerApi;
      defaults: VideoBroadcastDefaults;
      eventHandlers: VideoBroadcastEventHandlers;
    };

  constructor(env: {
    channelRegistry: ChannelRegistryEnv;
    videoStream: ChannelVideoStreamEnv;
    onCurrentChannelChange: SetCurrentChannelCallback;
    streamEventScheduler: StreamEventSchedulerApi;
    defaults: VideoBroadcastDefaults;
    eventHandlers: VideoBroadcastEventHandlers;
  }) {
    this.env = {
      ...env.channelRegistry,
      ...env.videoStream,
      onCurrentChannelChange: env.onCurrentChannelChange,
      streamEventScheduler: env.streamEventScheduler,
      defaults: env.defaults,
      eventHandlers: env.eventHandlers,
    };
  }

  get videoElement(): HTMLVideoElement {
    return this.env.videoElement;
  }
}

type EventHandlerKeys =
  | "onPlayStateChange"
  | "onFullScreenChange"
  | "onfocus"
  | "onblur"
  | "onChannelChangeSucceeded"
  | "onChannelChangeError"
  | "onProgrammesChanged"
  | "onParentalRatingChange"
  | "onParentalRatingError"
  | "onDRMRightsError"
  | "onSelectedComponentChanged"
  | "onComponentChanged";

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
  implements Omit<OIPF.DAE.Broadcast.VideoBroadcast, EventHandlerKeys> {}

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
