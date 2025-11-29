import {
  type Channel,
  ChannelChangeError,
  type ChannelConfig,
  type ChannelIdType,
  type ClassType,
  createLogger,
  ExtensionConfig,
  isValidChannelTriplet,
  type MessageBus,
  serializeChannelTriplet,
} from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import type { EventTarget } from "./eventTarget";
import type { Playback } from "./playback";
import { PlayState } from "./playback";
import type { VideoElement } from "./videoElement";

export namespace ChannelManager {
  export interface Contract {
    readonly currentChannel: Channel | null;
    onChannelChangeSucceeded?: OnChannelChangeSucceeded;
    onChannelChangeError?: OnChannelChangeError;
    bindToCurrentChannel: BindToCurrentChannel;
    setChannel: SetChannel;
    nextChannel: NextChannel;
    prevChannel: PrevChannel;
    getChannelConfig: GetChannelConfig;
    createChannelObject: CreateChannelObject;
    dispatchChannelError: DispatchChannelError;
    dispatchChannelSuccess: DispatchChannelSuccess;
  }

  export type OnChannelChangeSucceeded = (channel: Channel) => void;
  export type OnChannelChangeError = (channel: Channel, errorState: ChannelChangeError) => void;
  export type BindToCurrentChannel = () => Channel | null;
  export type SetChannel = (
    channel: Channel | null,
    trickplay?: boolean,
    contentAccessDescriptorURL?: string,
    quiet?: number,
  ) => void;
  export type NextChannel = () => void;
  export type PrevChannel = () => void;
  export type GetChannelConfig = () => ChannelConfig | null;
  export type CreateChannelObject = {
    (idType: ChannelIdType, dsd: string, sid: number): Channel | null;
    (
      idType: ChannelIdType,
      onid?: number,
      tsid?: number,
      sid?: number,
      sourceID?: number,
      ipBroadcastID?: string,
    ): Channel | null;
  };
  export type DispatchChannelError = (channel: Channel | null, errorState: ChannelChangeError) => void;
  export type DispatchChannelSuccess = (channel: Channel) => void;
}

const logger = createLogger("VideoBroadcast/Channel");

const isChannelEqual = (a: Channel, b: Channel): boolean =>
  isValidChannelTriplet(a) && isValidChannelTriplet(b) && serializeChannelTriplet(a) === serializeChannelTriplet(b);

export const WithChannel = <
  T extends ClassType<VideoElement.Contract & EventTarget.Contract & Playback.Contract & MessageBus.Contract>,
>(
  Base: T,
) =>
  class extends Base implements ChannelManager.Contract {
    currentChannelRef = IORef.newIORef<O.Option<Channel>>(O.none)();

    onChannelChangeSucceeded?: ChannelManager.OnChannelChangeSucceeded;
    onChannelChangeError?: ChannelManager.OnChannelChangeError;

    constructor(...args: any[]) {
      super(...args);

      this.videoElement.addEventListener("ChannelLoadSuccess", (event: Event) => {
        this.dispatchChannelSuccess((event as CustomEvent<Channel>).detail);
      });

      this.videoElement.addEventListener("ChannelLoadError", (event: Event) => {
        this.dispatchChannelError((event as CustomEvent<Channel>).detail, ChannelChangeError.UNIDENTIFIED_ERROR);
      });

      this.bus.on("UPDATE_CONFIG", ({ message: { payload } }) => {
        pipe(
          payload.currentChannel,
          O.fromNullable,
          ExtensionConfig.toChannel,
          O.filter((channel) =>
            pipe(
              this.currentChannelRef.read(),
              O.match(
                () => true,
                (currentChannel) => !isChannelEqual(channel, currentChannel),
              ),
            ),
          ),
          O.match(
            () => undefined,
            (channel) =>
              pipe(
                logger.info("Setting channel", channel),
                IO.flatMap(() => () => this.setChannel(channel)),
              )(),
          ),
        );
      });
    }

    get currentChannel(): Channel | null {
      return pipe(this.currentChannelRef.read(), O.toNullable);
    }

    dispatchChannelError: ChannelManager.DispatchChannelError = (channel, errorState) => {
      this.onChannelChangeError?.(channel || ({} as Channel), errorState);
      this.dispatchEvent(new CustomEvent("ChannelChangeError", { detail: { channel, errorState } }));
    };

    dispatchChannelSuccess: ChannelManager.DispatchChannelSuccess = (channel) => {
      this.onChannelChangeSucceeded?.(channel);
      this.dispatchEvent(new CustomEvent("ChannelChangeSucceeded", { detail: { channel } }));
    };

    bindToCurrentChannel: ChannelManager.BindToCurrentChannel = () =>
      pipe(
        logger.info("bindToCurrentChannel"),
        IO.flatMap(() => () => {
          if (!this.isPlayStateValid([PlayState.UNREALIZED, PlayState.STOPPED])) {
            return null;
          }

          return pipe(
            this.currentChannelRef.read(),
            O.map((channel) => {
              this.loadVideo(channel);
              return channel;
            }),
            O.toNullable,
          );
        }),
      )();

    setChannel: ChannelManager.SetChannel = (channel, _trickplay?, _contentAccessDescriptorURL?, _quiet?) =>
      pipe(
        logger.info("setChannel", channel),
        IO.map(() =>
          pipe(
            O.fromNullable(channel),
            O.match(
              () => {
                () =>
                  pipe(
                    logger.info("setChannel: starting transition to unrealized state"),
                    IO.flatMap(() =>
                      IO.of(() => {
                        this.currentChannelRef.write(O.none);
                        this.releaseVideo();
                      }),
                    ),
                  )();
              },
              (channel) => {
                if (!channel.idType) {
                  pipe(
                    logger.info("setChannel: channel idType not supported"),
                    IO.flatMap(() =>
                      IO.of(() => {
                        this.dispatchChannelError(channel, ChannelChangeError.CHANNEL_NOT_SUPPORTED);
                      }),
                    ),
                  )();
                  return;
                }

                this.currentChannelRef.write(O.some(channel));
                this.loadVideo(channel);
              },
            ),
          ),
        ),
      )();

    nextChannel: ChannelManager.NextChannel = () =>
      pipe(
        logger.info("nextChannel"),
        IO.flatMap(
          IO.of(() => {
            if (this.playState === PlayState.UNREALIZED) {
              this.dispatchChannelError(this.currentChannel, ChannelChangeError.NO_CHANNEL_LIST);
              return;
            }

            // TODO
            this.dispatchChannelError(this.currentChannel, ChannelChangeError.INSUFFICIENT_RESOURCES);
          }),
        ),
      )();

    prevChannel: ChannelManager.PrevChannel = () =>
      pipe(
        logger.info("prevChannel"),
        IO.flatMap(
          IO.of(() => {
            if (this.playState === PlayState.UNREALIZED) {
              this.dispatchChannelError(this.currentChannel, ChannelChangeError.NO_CHANNEL_LIST);
            }
          }),
        ),
      )();

    getChannelConfig: ChannelManager.GetChannelConfig = () =>
      pipe(
        logger.info("getChannelConfig"),
        IO.map(() => null),
      )();

    createChannelObject: ChannelManager.CreateChannelObject = (
      idType: ChannelIdType,
      ...args: unknown[]
    ): Channel | null => {
      return pipe(
        args as [number?, number?, number?, number?, string?],
        ([onid, tsid, sid, sourceID, ipBroadcastID]) => ({
          idType,
          onid,
          tsid,
          sid,
          sourceID,
          ipBroadcastID,
        }),
      );
    };
  };
