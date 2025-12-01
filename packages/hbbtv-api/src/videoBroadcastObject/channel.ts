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

export interface ChannelManager {
  currentChannel: Channel | null;
  onChannelChangeSucceeded?: (channel: Channel) => void;
  onChannelChangeError?: (channel: Channel, errorState: ChannelChangeError) => void;
  bindToCurrentChannel: () => Channel | null;
  setChannel: (
    channel: Channel | null,
    trickplay?: boolean,
    contentAccessDescriptorURL?: string,
    quiet?: number,
  ) => void;
  nextChannel: () => void;
  prevChannel: () => void;
  getChannelConfig: () => ChannelConfig | null;
  createChannelObject: {
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
  dispatchChannelError: (channel: Channel | null, errorState: ChannelChangeError) => void;
  dispatchChannelSuccess: (channel: Channel) => void;
}

const logger = createLogger("VideoBroadcast/Channel");

const isChannelEqual = (a: Channel, b: Channel): boolean =>
  isValidChannelTriplet(a) && isValidChannelTriplet(b) && serializeChannelTriplet(a) === serializeChannelTriplet(b);

export const WithChannel = <T extends ClassType<VideoElement & EventTarget & Playback & MessageBus>>(Base: T) =>
  class extends Base implements ChannelManager {
    currentChannelRef = IORef.newIORef<O.Option<Channel>>(O.none)();

    currentChannel: Channel | null = null;

    onChannelChangeSucceeded?: (channel: Channel) => void;
    onChannelChangeError?: (channel: Channel, errorState: ChannelChangeError) => void;

    constructor(...args: any[]) {
      super(...args);

      Object.defineProperty(this, "currentChannel", {
        get: () => pipe(this.currentChannelRef.read(), O.toNullable),
        enumerable: true,
        configurable: true,
      });

      this.videoElement.addEventListener("ChannelLoadSuccess", (event: Event) => {
        this.dispatchChannelSuccess((event as CustomEvent<Channel>).detail);
      });

      this.videoElement.addEventListener("ChannelLoadError", (event: Event) => {
        this.dispatchChannelError((event as CustomEvent<Channel>).detail, ChannelChangeError.UNIDENTIFIED_ERROR);
      });

      this.bus.on("UPDATE_CONFIG", (envelope) =>
        pipe(
          O.fromNullable(envelope.message.payload.currentChannel),
          ExtensionConfig.toChannel,
          O.filter((channel) =>
            pipe(
              this.currentChannelRef.read(),
              O.match(
                () => true,
                (current) => !isChannelEqual(channel, current),
              ),
            ),
          ),
          O.match(
            () => IO.of(undefined),
            (channel) =>
              pipe(
                logger.info("Setting channel", channel),
                IO.flatMap(() => () => this.setChannel(channel)),
              ),
          ),
        ),
      );
    }

    dispatchChannelError = (channel: Channel | null, errorState: ChannelChangeError): void => {
      this.onChannelChangeError?.(channel || ({} as Channel), errorState);
      this.dispatchEvent(new CustomEvent("ChannelChangeError", { detail: { channel, errorState } }));
    };

    dispatchChannelSuccess = (channel: Channel): void => {
      this.onChannelChangeSucceeded?.(channel);
      this.dispatchEvent(new CustomEvent("ChannelChangeSucceeded", { detail: { channel } }));
    };

    bindToCurrentChannel = (): Channel | null =>
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

    setChannel = (
      channel: Channel | null,
      _trickplay?: boolean,
      _contentAccessDescriptorURL?: string,
      _quiet?: number,
    ): void =>
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

    nextChannel = (): void =>
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

    prevChannel = (): void =>
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

    getChannelConfig = (): ChannelConfig | null =>
      pipe(
        logger.info("getChannelConfig"),
        IO.map(() => null),
      )();

    createChannelObject = (idType: ChannelIdType, ...args: unknown[]): Channel | null => {
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
