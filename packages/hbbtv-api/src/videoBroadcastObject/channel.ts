import type { Channel, ChannelConfig } from "../channels";
import { ChannelIdType } from "../channels";
import { type Constructor, log } from "../utils";
import type { WithPlayback } from "./playback";
import { PlayState } from "./playback";
import type { WithVideoElement } from "./videoElement";

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

const CHANNEL_CHANGE_DELAY = 500;

interface WithChannel {
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

export const WithChannel = <T extends Constructor<WithPlayback & WithVideoElement>>(Base: T) =>
  class extends Base implements WithChannel {
    currentChannel: Channel | null = null;

    onChannelChangeSucceeded?: (channel: Channel) => void;
    onChannelChangeError?: (channel: Channel, errorState: ChannelChangeError) => void;

    getChannelStreamUrl(channel: Channel): string {
      log(`Getting stream URL for channel: ${channel.name || channel.ccid}`);
      return "";
    }

    loadChannelStream(channel: Channel): void {
      const streamUrl = this.getChannelStreamUrl(channel);

      log(`Loading stream: ${streamUrl}`);

      // Set the video source
      this.videoElement.src = streamUrl;

      // The video element will trigger events that WithPlayback will handle
      // This will eventually transition to PRESENTING state when playing
    }

    dispatchChannelError(channel: Channel, errorState: ChannelChangeError): void {
      this.onChannelChangeError?.(channel, errorState);
      this.dispatchEvent(new CustomEvent("ChannelChangeError", { detail: { channel, errorState } }));
    }

    dispatchChannelSuccess(channel: Channel): void {
      this.onChannelChangeSucceeded?.(channel);
      this.dispatchEvent(new CustomEvent("ChannelChangeSucceeded", { detail: { channel } }));
    }

    scheduleChannelSuccess(channel: Channel): void {
      setTimeout(() => {
        this.dispatchChannelSuccess(channel);
        // this.dispatchPlayStateChange(PlayState.PRESENTING);
      }, CHANNEL_CHANGE_DELAY);
    }

    handleChannelError(channel: Channel, errorState: ChannelChangeError): void {
      this.dispatchChannelError(channel, errorState);
      if (!this.isPlayStateValid([PlayState.PRESENTING, PlayState.CONNECTING])) {
        this.dispatchPlayStateChange(PlayState.UNREALIZED);
      }
    }

    bindToCurrentChannel(): Channel | null {
      log("bindToCurrentChannel");

      if (!this.isPlayStateValid([PlayState.UNREALIZED, PlayState.STOPPED])) {
        return null;
      }

      if (!this.currentChannel) {
        this.dispatchPlayStateChange(PlayState.UNREALIZED);
        return null;
      }

      this.dispatchPlayStateChange(PlayState.CONNECTING);

      this.scheduleChannelSuccess(this.currentChannel);

      return this.currentChannel;
    }

    setChannel(
      channel: Channel | null,
      _trickplay?: boolean,
      _contentAccessDescriptorURL?: string,
      _quiet?: number,
    ): void {
      log(`setChannel: ${channel?.name || "null"}`);

      if (channel === null) {
        this.currentChannel = null;
        this.dispatchPlayStateChange(PlayState.UNREALIZED);
        this.dispatchChannelSuccess(channel as unknown as Channel);
        return;
      }

      if (!channel.idType) {
        this.handleChannelError(channel, ChannelChangeError.CHANNEL_NOT_SUPPORTED);
        return;
      }

      this.currentChannel = channel;
      this.dispatchPlayStateChange(PlayState.CONNECTING);

      // Load the channel stream
      this.loadChannelStream(channel);

      this.scheduleChannelSuccess(channel);
    }

    nextChannel(): void {
      log("nextChannel");

      if (this.playState === PlayState.UNREALIZED) {
        const channel = this.currentChannel || ({} as Channel);
        this.handleChannelError(channel, ChannelChangeError.NO_CHANNEL_LIST);
        return;
      }

      this.handleChannelError(this.currentChannel || ({} as Channel), ChannelChangeError.NO_CHANNEL_LIST);
    }

    prevChannel(): void {
      log("prevChannel");

      if (this.playState === PlayState.UNREALIZED) {
        const channel = this.currentChannel || ({} as Channel);
        this.handleChannelError(channel, ChannelChangeError.NO_CHANNEL_LIST);
        return;
      }

      this.handleChannelError(this.currentChannel || ({} as Channel), ChannelChangeError.NO_CHANNEL_LIST);
    }

    getChannelConfig(): ChannelConfig | null {
      log("getChannelConfig");
      return null;
    }

    createChannelObject(idType: ChannelIdType, dsd: string, sid: number): Channel | null;
    createChannelObject(
      idType: ChannelIdType,
      onid?: number,
      tsid?: number,
      sid?: number,
      sourceID?: number,
      ipBroadcastID?: string,
    ): Channel | null;
    createChannelObject(idType: ChannelIdType, ...args: unknown[]): Channel | null {
      log(`createChannelObject(${idType})`);

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
    }
  };
