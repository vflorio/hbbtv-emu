import type { Channel, ChannelConfig, Programme } from "./channels";
import { ChannelIdType } from "./channels";
import { type Collection, createEmptyCollection, log } from "./utils";

export enum PlayState {
  UNREALIZED = 0,
  CONNECTING = 1,
  PRESENTING = 2,
  STOPPED = 3,
}

export enum ComponentType {
  VIDEO = 0,
  AUDIO = 1,
  SUBTITLE = 2,
}

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

export interface AVComponent {
  componentTag: number;
  pid: number;
  type: ComponentType;
  encoding: string;
  encrypted: boolean;
  audioChannels?: number;
  audioDescription?: boolean;
  language?: string;
}

interface VideoBroadcastState {
  playState: PlayState;
  currentChannel: Channel | null;
  volume: number;
  fullScreen: boolean;
}

const INITIAL_STATE: Readonly<VideoBroadcastState> = {
  playState: PlayState.UNREALIZED,
  currentChannel: null,
  volume: 100,
  fullScreen: false,
} as const;

const CHANNEL_CHANGE_DELAY = 500;

export class VideoBroadcastObject {
  // Component type constants
  readonly COMPONENT_TYPE_VIDEO = ComponentType.VIDEO;
  readonly COMPONENT_TYPE_AUDIO = ComponentType.AUDIO;
  readonly COMPONENT_TYPE_SUBTITLE = ComponentType.SUBTITLE;

  // Internal state
  private state: VideoBroadcastState = { ...INITIAL_STATE };
  readonly videoElement: HTMLVideoElement;

  // Event handlers (VideoBroadcastObject interface)
  onPlayStateChange?: (state: PlayState, error?: number) => void;
  onChannelChangeSucceeded?: (channel: Channel) => void;
  onChannelChangeError?: (channel: Channel, errorState: ChannelChangeError) => void;
  onFullScreenChange?: () => void;
  onProgrammesChanged?: () => void;
  onSelectedComponentChanged?: (componentType?: ComponentType) => void;
  onComponentChanged?: (componentType?: ComponentType) => void;
  onParentalRatingChange?: (
    contentID: string | null,
    ratings: unknown,
    DRMSystemID: string | null,
    blocked: boolean,
  ) => void;
  onParentalRatingError?: (contentID: string | null, ratings: unknown, DRMSystemID: string | null) => void;
  onDRMRightsError?: (
    errorState: number,
    contentID: string | null,
    DRMSystemID: string | null,
    rightsIssuerURL?: string,
  ) => void;

  constructor() {
    log("createVideoBroadcastObject");

    this.videoElement = document.createElement("video");
  }

  // Getters
  get playState(): PlayState {
    return this.state.playState;
  }

  get currentChannel(): Channel | null {
    return this.state.currentChannel;
  }

  get programmes(): Collection<Programme> {
    return createEmptyCollection();
  }

  get fullScreen(): boolean {
    return this.state.fullScreen;
  }

  get data(): string {
    return "";
  }

  set data(_value: string) {
    // No-op
  }

  // HTMLVideoElement delegation
  get onfocus(): ((this: GlobalEventHandlers, ev: FocusEvent) => unknown) | null {
    return this.videoElement.onfocus;
  }

  set onfocus(handler: ((this: GlobalEventHandlers, ev: FocusEvent) => unknown) | null) {
    this.videoElement.onfocus = handler;
  }

  get onblur(): ((this: GlobalEventHandlers, ev: FocusEvent) => unknown) | null {
    return this.videoElement.onblur;
  }

  set onblur(handler: ((this: GlobalEventHandlers, ev: FocusEvent) => unknown) | null) {
    this.videoElement.onblur = handler;
  }

  dispatchEvent(event: Event): boolean {
    return this.videoElement.dispatchEvent(event);
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.videoElement.addEventListener(type, listener, options);
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void {
    this.videoElement.removeEventListener(type, listener, options);
  }

  // Private helper methods
  private dispatchPlayStateChange(newState: PlayState, error?: number): void {
    const oldState = this.state.playState;
    this.state.playState = newState;

    log(`VideoBroadcast state: ${oldState} -> ${newState}`);

    this.onPlayStateChange?.(newState, error);
    this.dispatchEvent(new CustomEvent("PlayStateChange", { detail: { state: newState, error } }));
  }

  private dispatchChannelError(channel: Channel, errorState: ChannelChangeError): void {
    this.onChannelChangeError?.(channel, errorState);
    this.dispatchEvent(new CustomEvent("ChannelChangeError", { detail: { channel, errorState } }));
  }

  private dispatchChannelSuccess(channel: Channel): void {
    this.onChannelChangeSucceeded?.(channel);
    this.dispatchEvent(new CustomEvent("ChannelChangeSucceeded", { detail: { channel } }));
  }

  private dispatchComponentChange(componentType?: ComponentType): void {
    this.onSelectedComponentChanged?.(componentType);
  }

  private createMockChannel(): Channel {
    return {
      idType: ChannelIdType.ID_DVB_T,
      name: "Current Channel",
      ccid: "ccid:dvbt.0",
      onid: 1,
      tsid: 1,
      sid: 1,
    };
  }

  private scheduleChannelSuccess(channel: Channel): void {
    setTimeout(() => {
      this.dispatchChannelSuccess(channel);
      this.dispatchPlayStateChange(PlayState.PRESENTING);
    }, CHANNEL_CHANGE_DELAY);
  }

  private isPlayStateValid(validStates: PlayState[]): boolean {
    return validStates.includes(this.state.playState);
  }

  private handleChannelError(channel: Channel, errorState: ChannelChangeError): void {
    this.dispatchChannelError(channel, errorState);
    if (!this.isPlayStateValid([PlayState.PRESENTING, PlayState.CONNECTING])) {
      this.dispatchPlayStateChange(PlayState.UNREALIZED);
    }
  }

  // Public API methods
  bindToCurrentChannel(): Channel | null {
    log("bindToCurrentChannel");

    if (!this.isPlayStateValid([PlayState.UNREALIZED, PlayState.STOPPED])) {
      return null;
    }

    const channel = this.createMockChannel();
    this.state.currentChannel = channel;
    this.dispatchPlayStateChange(PlayState.CONNECTING);
    this.scheduleChannelSuccess(channel);

    return channel;
  }

  setChannel(
    channel: Channel | null,
    _trickplay?: boolean,
    _contentAccessDescriptorURL?: string,
    _quiet?: number,
  ): void {
    log(`setChannel: ${channel?.name || "null"}`);

    if (channel === null) {
      this.state.currentChannel = null;
      this.dispatchPlayStateChange(PlayState.UNREALIZED);
      this.dispatchChannelSuccess(channel as unknown as Channel);
      return;
    }

    if (!channel.idType) {
      this.handleChannelError(channel, ChannelChangeError.CHANNEL_NOT_SUPPORTED);
      return;
    }

    this.state.currentChannel = channel;
    this.dispatchPlayStateChange(PlayState.CONNECTING);
    this.scheduleChannelSuccess(channel);
  }

  nextChannel(): void {
    log("nextChannel");

    if (this.state.playState === PlayState.UNREALIZED) {
      const channel = this.state.currentChannel || ({} as Channel);
      this.handleChannelError(channel, ChannelChangeError.NO_CHANNEL_LIST);
      return;
    }

    this.handleChannelError(this.state.currentChannel || ({} as Channel), ChannelChangeError.NO_CHANNEL_LIST);
  }

  prevChannel(): void {
    log("prevChannel");

    if (this.state.playState === PlayState.UNREALIZED) {
      const channel = this.state.currentChannel || ({} as Channel);
      this.handleChannelError(channel, ChannelChangeError.NO_CHANNEL_LIST);
      return;
    }

    this.handleChannelError(this.state.currentChannel || ({} as Channel), ChannelChangeError.NO_CHANNEL_LIST);
  }

  stop(): void {
    log("stop");

    if (this.state.playState !== PlayState.UNREALIZED) {
      this.dispatchPlayStateChange(PlayState.STOPPED);
    }
  }

  release(): void {
    log("release");
    this.state.currentChannel = null;
    this.dispatchPlayStateChange(PlayState.UNREALIZED);
  }

  setFullScreen(fullScreen: boolean): void {
    log(`setFullScreen(${fullScreen})`);

    const changed = this.state.fullScreen !== fullScreen;
    this.state.fullScreen = fullScreen;

    if (changed) {
      this.onFullScreenChange?.();
      this.dispatchEvent(new CustomEvent("FullScreenChange", { detail: { fullScreen } }));
    }
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

  setVolume(volume: number): boolean {
    log(`setVolume(${volume})`);

    if (volume < 0 || volume > 100) {
      return false;
    }

    const changed = this.state.volume !== volume;
    this.state.volume = volume;
    return changed;
  }

  getVolume(): number {
    log("getVolume");
    return this.state.volume;
  }

  getComponents(_componentType?: ComponentType): Collection<AVComponent> | null {
    log("getComponents");
    return this.state.playState === PlayState.PRESENTING ? createEmptyCollection() : null;
  }

  getCurrentActiveComponents(_componentType?: ComponentType): Collection<AVComponent> | null {
    log("getCurrentActiveComponents");
    return this.state.playState === PlayState.PRESENTING ? createEmptyCollection() : null;
  }

  selectComponent(component: AVComponent): void;
  selectComponent(componentType: ComponentType): void;
  selectComponent(component: AVComponent | ComponentType): void {
    const componentType = typeof component === "number" ? component : component.type;

    log(`selectComponent(${typeof component === "number" ? ComponentType[component] : "AVComponent"})`);

    this.dispatchComponentChange(componentType);
  }

  unselectComponent(component: AVComponent): void;
  unselectComponent(componentType: ComponentType): void;
  unselectComponent(component: AVComponent | ComponentType): void {
    const componentType = typeof component === "number" ? component : component.type;

    log(`unselectComponent(${typeof component === "number" ? ComponentType[component] : "AVComponent"})`);

    this.dispatchComponentChange(componentType);
  }
}
