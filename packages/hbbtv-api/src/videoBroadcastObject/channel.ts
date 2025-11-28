import {
  type Channel,
  ChannelChangeError,
  type ChannelConfig,
  ChannelIdType,
  type ClassType,
  createLogger,
  ExtensionConfig,
  isValidChannelTriplet,
  type MessageBus,
  serializeChannelTriplet,
} from "@hbb-emu/lib";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as IORef from "fp-ts/IORef";
import type { EventTarget } from "./eventTarget";
import type { Playback } from "./playback";
import { PlayState } from "./playback";
import type { VideoElement } from "./videoElement";
import * as TE from "fp-ts/TaskEither";

export interface ChannelManager {
  get currentChannel(): Channel | null;
  onChannelChangeSucceeded?: (channel: Channel) => void;
  onChannelChangeError?: (channel: Channel, errorState: ChannelChangeError) => void;
  bindToCurrentChannel(): Channel | null;
  setChannel(channel: Channel | null, trickplay?: boolean, contentAccessDescriptorURL?: string, quiet?: number): void;
  nextChannel(): void;
  prevChannel(): void;
  getChannelConfig(): ChannelConfig | null;
  createChannelObject(idType: ChannelIdType, dsd: string, sid: number): Channel | null;
  createChannelObject(
    idType: ChannelIdType,
    onid?: number,
    tsid?: number,
    sid?: number,
    sourceID?: number,
    ipBroadcastID?: string,
  ): Channel | null;
}

const logger = createLogger("VideoBroadcast/Channel");

const isChannelEqual = (a: Channel, b: Channel): boolean =>
  isValidChannelTriplet(a) && isValidChannelTriplet(b) && serializeChannelTriplet(a) === serializeChannelTriplet(b);

export const WithChannel = <T extends ClassType<VideoElement & EventTarget & Playback & MessageBus>>(Base: T) =>
  class extends Base implements ChannelManager {
    currentChannelRef = IORef.newIORef<O.Option<Channel>>(O.none)();

    onChannelChangeSucceeded?: (channel: Channel) => void;
    onChannelChangeError?: (channel: Channel, errorState: ChannelChangeError) => void;

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
          O.map((channel) => {
            logger.log("Setting channel", channel);
            this.setChannel(channel);
          }),
        );
        return TE.right(void 0);
      });
    }

    get currentChannel(): Channel | null {
      return pipe(this.currentChannelRef.read(), O.toNullable);
    }

    dispatchChannelError = (channel: Channel | null, errorState: ChannelChangeError) => {
      this.onChannelChangeError?.(channel || ({} as Channel), errorState);
      this.dispatchEvent(new CustomEvent("ChannelChangeError", { detail: { channel, errorState } }));
    };

    dispatchChannelSuccess = (channel: Channel) => {
      this.onChannelChangeSucceeded?.(channel);
      this.dispatchEvent(new CustomEvent("ChannelChangeSucceeded", { detail: { channel } }));
    };

    bindToCurrentChannel = (): Channel | null => {
      logger.log("bindToCurrentChannel");

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
    };

    setChannel = (
      channel: Channel | null,
      _trickplay?: boolean,
      _contentAccessDescriptorURL?: string,
      _quiet?: number,
    ) => {
      logger.log("setChannel", channel);
      pipe(
        O.fromNullable(channel),
        O.match(
          () => {
            logger.log("setChannel: starting transition to unrealized state");
            this.currentChannelRef.write(O.none);
            this.releaseVideo();
          },
          (channel) => {
            if (!channel.idType) {
              logger.log("setChannel: channel idType not supported");
              this.dispatchChannelError(channel, ChannelChangeError.CHANNEL_NOT_SUPPORTED);
              return;
            }

            this.currentChannelRef.write(O.some(channel));
            this.loadVideo(channel);
          },
        ),
      );
    };

    nextChannel = () => {
      logger.log("nextChannel");

      if (this.playState === PlayState.UNREALIZED) {
        this.dispatchChannelError(this.currentChannel, ChannelChangeError.NO_CHANNEL_LIST);
        return;
      }

      // TODO
      this.dispatchChannelError(this.currentChannel, ChannelChangeError.INSUFFICIENT_RESOURCES);
    };

    prevChannel = () => {
      logger.log("prevChannel");

      if (this.playState === PlayState.UNREALIZED) {
        this.dispatchChannelError(this.currentChannel, ChannelChangeError.NO_CHANNEL_LIST);
        return;
      }

      // TODO
      this.dispatchChannelError(this.currentChannel, ChannelChangeError.INSUFFICIENT_RESOURCES);
    };

    getChannelConfig = (): ChannelConfig | null => {
      logger.log("getChannelConfig");
      return null;
    };

    createChannelObject = (idType: ChannelIdType, ...args: unknown[]): Channel | null => {
      logger.log(`createChannelObject(${idType})`);

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
