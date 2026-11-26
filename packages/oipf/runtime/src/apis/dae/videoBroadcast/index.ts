/**
 * video/broadcast (OIPF DAE §7.13.1)
 *
 * The object is composed from its parts (ROADMAP D1): each one is a Reader module
 * with its own environment (`channel`, `display`, `volume`, `component`,
 * `streamEvent`, `misc`), and the object exposes the union of their OIPF surfaces.
 * No inheritance: the parts depend only on what their environment provides.
 *
 * The settings UI's state (`VideoBroadcastState`) is read and written through the
 * same modules, so its edits follow the same rules as the application's.
 */

import { createStatefulMethods, type Stateful } from "@hbb-emu/core";
import type { OIPF, VideoBroadcastState } from "@hbb-emu/oipf-api";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type {
  ChannelChangeRequest,
  ChannelRegistryEnv,
  FetchStreamEventDescription,
  StreamEventSchedulerApi,
} from "../../../subsystems";
import { combine, readOnly, stateSchema } from "../../compose";
import {
  applyChannelState,
  type ChannelApi,
  type ChannelVideoStreamEnv,
  channelApi,
  createChannelEnv,
  readChannelState,
  startChannel,
  tuneTo,
} from "./channel";
import {
  applyComponentState,
  type ComponentApi,
  componentApi,
  createComponentEnv,
  readComponentState,
} from "./component";
import {
  applyDisplayState,
  createDisplayEnv,
  type DisplayApi,
  displayApi,
  readDisplayState,
  type VideoWindow,
} from "./display";
import { applyProgrammes, createMiscEnv, type MiscApi, miscApi, readProgrammes } from "./misc";
import {
  createStreamEventEnv,
  dropStreamEventListeners,
  readStreamEventListeners,
  type StreamEventApi,
  streamEventApi,
} from "./streamEvent";
import {
  type AudioOutput,
  applyVolumeState,
  createVolumeEnv,
  readVolumeState,
  resetVolume,
  type VolumeApi,
  volumeApi,
} from "./volume";

/**
 * Callback to notify the global current channel provider of channel changes.
 */
export type SetCurrentChannelCallback = (channel: OIPF.DAE.Broadcast.Channel | null) => void;

export type VideoBroadcastDefaults = Readonly<{
  fullScreen: boolean;
  playState: OIPF.DAE.Broadcast.PlayState;
}>;

export type VideoBroadcastEventHandlers = Readonly<{
  onPlayStateChange: (state: OIPF.DAE.Broadcast.PlayState) => void;
  onFullScreenChange: (fullscreen: boolean) => void;
  onfocus: () => void;
  onblur: () => void;
  onChannelChangeSucceeded: (channel: OIPF.DAE.Broadcast.Channel) => void;
  /** `null` only when there was no channel to change from or to (`nextChannel()` with none). */
  onChannelChangeError: (channel: OIPF.DAE.Broadcast.Channel | null, error: number) => void;
  onProgrammesChanged: () => void;
  onParentalRatingChange: (contentId: string, ratings: string[], blocked: boolean) => void;
  onParentalRatingError: (contentId: string, ratings: string[], drmSystemId: string) => void;
  onDRMRightsError: (errorState: string, contentId: string, drmSystemId: string, rightsIssuerUrl: string) => void;
  onSelectedComponentChanged: (componentType: number) => void;
  onComponentChanged: (componentType: number, added: boolean) => void;
}>;

export type VideoBroadcastDependencies = Readonly<{
  channelRegistry: ChannelRegistryEnv;
  videoStream: ChannelVideoStreamEnv;
  /** Where the object's audio goes: in series with the TV's volume (`audioInSeries`). */
  audioOutput: AudioOutput;
  videoWindow: VideoWindow;
  /** The channel the TV is tuned to: what a new object presents. */
  getTunedChannel: () => OIPF.DAE.Broadcast.Channel | null;
  /** Asks the TV before the application changes to another service. */
  requestChannelChange: ChannelChangeRequest;
  onCurrentChannelChange: SetCurrentChannelCallback;
  streamEventScheduler: StreamEventSchedulerApi;
  /** Fetches the XML descriptions of stream events (`targetURL` over HTTP(S)). */
  fetchStreamEventDescription: FetchStreamEventDescription;
  /** The document's base URL: what a relative `targetURL` is relative to. */
  baseURI: () => string;
  defaults: VideoBroadcastDefaults;
  eventHandlers: VideoBroadcastEventHandlers;
}>;

/** Handlers the application sets on the element itself (see `extractVideoBroadcastEventHandlers`). */
type EventHandlerKeys =
  | "onPlayStateChange"
  | "onFullScreenChange"
  | "onfocus"
  | "onblur"
  | "onChannelChangeSucceeded"
  | "onChannelChangeError";

export type VideoBroadcastApi = ChannelApi & DisplayApi & VolumeApi & ComponentApi & StreamEventApi & MiscApi;

export type VideoBroadcast = VideoBroadcastApi &
  Stateful<VideoBroadcastState> &
  Readonly<{
    /** The video the object presents, mounted inside the `<object>`. */
    videoElement: HTMLVideoElement;
    /** The TV changed channel (not the application): the object presents it, nobody is asked. */
    tuneTo: (channel: OIPF.DAE.Broadcast.Channel) => void;
  }>;

export const createVideoBroadcast = (dependencies: VideoBroadcastDependencies): VideoBroadcast => {
  const { videoStream, eventHandlers, defaults } = dependencies;

  const volume = createVolumeEnv(dependencies.audioOutput)();
  const streamEvent = createStreamEventEnv({
    scheduler: dependencies.streamEventScheduler,
    fetchDescription: dependencies.fetchStreamEventDescription,
    baseURI: dependencies.baseURI,
  })();
  const channel = createChannelEnv(
    {
      getChannels: dependencies.channelRegistry.getChannels,
      player: videoStream,
      getTunedChannel: dependencies.getTunedChannel,
      requestChannelChange: dependencies.requestChannelChange,
      channelEvents: {
        onPlayStateChange: (playState) => () => eventHandlers.onPlayStateChange(playState),
        // TS 102 796 §10.2.12 (volume) and §8.2.1.1 (stream event listeners).
        onUnrealized: pipe(
          resetVolume(volume),
          IO.flatMap(() => dropStreamEventListeners(streamEvent)),
        ),
        onLeaveChannel: dropStreamEventListeners(streamEvent),
        onChannelChangeSucceeded: (current) => () => eventHandlers.onChannelChangeSucceeded(current),
        onChannelChangeError: (target, error) => () => eventHandlers.onChannelChangeError(target, error),
        onCurrentChannelChange: (current) =>
          pipe(
            () => dependencies.onCurrentChannelChange(current),
            IO.flatMap(() => dependencies.streamEventScheduler.setCurrentChannel(current)),
          ),
      },
    },
    defaults.playState,
  )();
  const display = createDisplayEnv(
    dependencies.videoWindow,
    { onFullScreenChange: (fullScreen) => () => eventHandlers.onFullScreenChange(fullScreen) },
    defaults.fullScreen,
  )();
  const component = createComponentEnv();
  const misc = createMiscEnv();

  const api = combine(
    channelApi(channel),
    displayApi(display),
    volumeApi(volume),
    componentApi(component),
    streamEventApi(streamEvent),
    miscApi(misc),
  );
  // Every member of the spec's video/broadcast, but the handlers set on the element.
  type ObjectApi = Omit<OIPF.DAE.Broadcast.VideoBroadcast, EventHandlerKeys> & VideoBroadcastApi;
  const object: ObjectApi = api;

  type Channel = OIPF.DAE.Broadcast.Channel;
  type Programmes = ReadonlyArray<OIPF.DAE.Broadcast.Programme>;
  const stateful = createStatefulMethods<VideoBroadcastState, ObjectApi>(
    stateSchema<VideoBroadcastState, ObjectApi>({
      playState: {
        read: () => readChannelState(channel)().playState,
        apply: (playState: OIPF.DAE.Broadcast.PlayState) => applyChannelState({ playState })(channel),
      },
      currentChannel: {
        read: () => readChannelState(channel)().currentChannel,
        apply: (currentChannel: Channel) => applyChannelState({ currentChannel })(channel),
      },
      fullScreen: {
        read: () => readDisplayState(display)().fullScreen,
        apply: (fullScreen: boolean) => applyDisplayState({ fullScreen })(display),
      },
      width: {
        read: () => readDisplayState(display)().width,
        apply: (width: number) => applyDisplayState({ width })(display),
      },
      height: {
        read: () => readDisplayState(display)().height,
        apply: (height: number) => applyDisplayState({ height })(display),
      },
      volume: {
        read: () => readVolumeState(volume)().volume,
        apply: (level: number) => applyVolumeState({ volume: level })(volume),
      },
      muted: {
        read: () => readVolumeState(volume)().muted,
        apply: (muted: boolean) => applyVolumeState({ muted })(volume),
      },
      programmes: {
        read: () => [...readProgrammes(misc)()],
        apply: (programmes: Programmes) => applyProgrammes(programmes)(misc),
      },
      components: {
        read: () => [...readComponentState(component)().components],
        apply: (components: ReadonlyArray<unknown>) => applyComponentState({ components })(component),
      },
      selectedComponents: {
        read: () => ({ ...readComponentState(component)().selectedComponents }),
        apply: (selectedComponents: Record<string, unknown>) => applyComponentState({ selectedComponents })(component),
      },
      // The application's subscriptions: the settings UI only reads them.
      streamEventListeners: readOnly(() => [...readStreamEventListeners(streamEvent)()]),
    }),
    object,
  );

  const videoBroadcast: VideoBroadcast = combine(object, {
    videoElement: videoStream.videoElement,
    tuneTo: (to: Channel) => {
      void tuneTo(to)(channel)();
    },
    applyState: stateful.applyState,
    getState: stateful.getState,
    subscribe: stateful.subscribe,
    notifyStateChange: stateful.notifyStateChange,
  });

  // Once every part exists: the object follows its stream and presents the TV's channel.
  startChannel(channel)();
  return videoBroadcast;
};
