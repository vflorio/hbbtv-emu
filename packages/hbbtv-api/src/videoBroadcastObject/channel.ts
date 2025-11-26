import { type Channel, ChannelIdType, type ClassType, createLogger } from "@hbb-emu/lib";
import type { EventTarget } from "./eventTarget";
import type { Playback } from "./playback";
import { PlayState } from "./playback";
import type { VideoElement } from "./videoElement";

export enum ChannelChangeError {
  CHANNEL_NOT_SUPPORTED = 0,
  CANNOT_TUNE = 1,
  TUNER_LOCKED = 2,
  PARENTAL_LOCK = 3,
  ENCRYPTED_NO_KEY = 4,
  UNKNOWN_CHANNEL = 5,
  INTERRUPTED = 6,
  RECORDING = 7,
  CANNOT_RESOLVE_URI = 8,
  INSUFFICIENT_BANDWIDTH = 9,
  NO_CHANNEL_LIST = 10,
  INSUFFICIENT_RESOURCES = 11,
  CHANNEL_NOT_IN_TS = 12,
  UNIDENTIFIED_ERROR = 100,
}

export interface ChannelConfig {
  channelList: { readonly length: number; item(index: number): Channel | null };
  readonly favouriteLists?: unknown;
}

export interface ChannelManager {
  currentChannel: Channel | null;
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

const logger = createLogger("Channel");

export const WithChannel = <T extends ClassType<VideoElement & EventTarget & Playback>>(Base: T) =>
  class extends Base implements ChannelManager {
    currentChannel: Channel | null = null;

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

      if (!this.currentChannel) {
        return null;
      }

      this.loadVideo(this.currentChannel);

      return this.currentChannel;
    };

    setChannel = (
      channel: Channel | null,
      _trickplay?: boolean,
      _contentAccessDescriptorURL?: string,
      _quiet?: number,
    ) => {
      logger.log(`setChannel: ${channel?.name || "null"}`);

      if (channel === null) {
        this.currentChannel = null;
        this.stopVideo();
        // TODO assicurarsi che scatta la transizione a unrealized
        return;
      }

      if (!channel.idType) {
        this.dispatchChannelError(channel, ChannelChangeError.CHANNEL_NOT_SUPPORTED);
        return;
      }

      this.currentChannel = channel;
      this.loadVideo(channel);
    };

    nextChannel = () => {
      logger.log("nextChannel");

      if (this.playState === PlayState.UNREALIZED) {
        const channel = this.currentChannel;
        this.dispatchChannelError(channel, ChannelChangeError.NO_CHANNEL_LIST);
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

      if (idType === ChannelIdType.ID_DVB_SI_DIRECT && args.length >= 2) {
        const [dsd, sid] = args as [string, number];
        return { idType, dsd, sid };
      }

      const [onid, tsid, sid, sourceID, ipBroadcastID] = args as [
        number | undefined,
        number | undefined,
        number | undefined,
        number | undefined,
        string | undefined,
      ];

      return { idType, onid, tsid, sid, sourceID, ipBroadcastID };
    };
  };
