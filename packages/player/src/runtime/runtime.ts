import { createLogger } from "@hbb-emu/core";
import { match } from "ts-pattern";
import type { PlaybackType } from "../playback/types";
import type { PlayerState } from "../state/states";
import { NativeAdapter } from "./adapters/native";
import { initialState, reduce } from "./reducer";
import type { PlayerEffect, PlayerEvent, PlayerRuntime as PlayerRuntimeI, PlayerStateListener } from "./types";

type AnyAdapter = NativeAdapter;

type RuntimeAdapter = {
  readonly type: PlaybackType;
  readonly name: string;
  mount(videoElement: HTMLVideoElement): void;
  load(url: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(time: number): Promise<void>;
  destroy(): Promise<void>;
  subscribe(listener: (event: PlayerEvent) => void): () => void;
};

export class PlayerRuntime implements PlayerRuntimeI<PlayerState.Any> {
  private state: PlayerState.Any = initialState();
  private playbackType: PlaybackType | null = null;

  private videoElement: HTMLVideoElement | null = null;
  private adapter: RuntimeAdapter | null = null;
  private adapterUnsub: (() => void) | null = null;

  private listeners = new Set<PlayerStateListener<PlayerState.Any>>();

  private readonly logger = createLogger("PlayerRuntime");

  private eventQueue: PlayerEvent[] = [];
  private processing = false;

  getState = () => this.state;

  getPlaybackType = () => this.playbackType;

  subscribe = (listener: PlayerStateListener<PlayerState.Any>) => {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  };

  mount = (videoElement: HTMLVideoElement) => {
    this.videoElement = videoElement;
    this.dispatch({ _tag: "Engine/Mounted" });
  };

  destroy = () => {
    this.runEffect({ _tag: "Effect/DestroyAdapter" });
    this.listeners.clear();
  };

  dispatch = (event: PlayerEvent) => {
    this.eventQueue.push(event);
    this.processQueue();
  };

  private notify = () => {
    for (const l of this.listeners) l(this.state);
  };

  private processQueue = async () => {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;

        const prev = this.state;
        const { next, effects } = reduce(prev, event);
        this.state = next;

        this.logger.debug?.("event", (event as any)._tag, "prev", prev._tag, "next", next._tag);

        this.notify();

        for (const eff of effects) {
          await this.runEffect(eff);
        }
      }
    } finally {
      this.processing = false;
    }
  };

  private runEffect = async (effect: PlayerEffect) =>
    match(effect)
      .with({ _tag: "Effect/DestroyAdapter" }, async () => {
        if (this.adapterUnsub) {
          this.adapterUnsub();
          this.adapterUnsub = null;
        }
        if (this.adapter) {
          const adapter = this.adapter;
          this.adapter = null;
          this.playbackType = null;
          try {
            await adapter.destroy();
          } catch (cause) {
            this.logger.warn("destroy failed", cause);
          }
        }
      })
      .with({ _tag: "Effect/CreateAdapter" }, async ({ playbackType, url }) => {
        this.playbackType = playbackType;

        if (playbackType !== "native") {
          this.dispatch({
            _tag: "Engine/Error",
            kind: "not-supported",
            message: `Playback type not supported by runtime yet: ${playbackType}`,
            url,
          });
          return;
        }

        const adapter: AnyAdapter = new NativeAdapter();
        this.adapter = adapter as unknown as RuntimeAdapter;

        if (this.adapterUnsub) this.adapterUnsub();
        this.adapterUnsub = this.adapter.subscribe((e: PlayerEvent) => this.dispatch(e));
      })
      .with({ _tag: "Effect/AttachVideoElement" }, async () => {
        if (!this.adapter) {
          this.dispatch({ _tag: "Engine/Error", kind: "unknown", message: "No adapter to attach" });
          return;
        }
        if (!this.videoElement) {
          this.dispatch({ _tag: "Engine/Error", kind: "unknown", message: "No video element mounted" });
          return;
        }
        try {
          this.adapter.mount(this.videoElement);
        } catch (cause) {
          this.dispatch({ _tag: "Engine/Error", kind: "unknown", message: "Attach failed", cause });
        }
      })
      .with({ _tag: "Effect/LoadSource" }, async ({ url }) => {
        if (!this.adapter) {
          this.dispatch({ _tag: "Engine/Error", kind: "unknown", message: "No adapter to load source" });
          return;
        }
        try {
          await this.adapter.load(url);
        } catch (cause) {
          this.dispatch({ _tag: "Engine/Error", kind: "network", message: "Load failed", url, cause });
        }
      })
      .with({ _tag: "Effect/Play" }, async () => {
        if (!this.adapter) return;
        try {
          await this.adapter.play();
        } catch (cause) {
          this.dispatch({ _tag: "Engine/Error", kind: "media", message: "Play failed", cause });
        }
      })
      .with({ _tag: "Effect/Pause" }, async () => {
        if (!this.adapter) return;
        try {
          await this.adapter.pause();
        } catch (cause) {
          this.dispatch({ _tag: "Engine/Error", kind: "media", message: "Pause failed", cause });
        }
      })
      .with({ _tag: "Effect/Seek" }, async ({ time }) => {
        if (!this.adapter) return;
        try {
          await this.adapter.seek(time);
        } catch (cause) {
          this.dispatch({ _tag: "Engine/Error", kind: "media", message: "Seek failed", cause });
        }
      })
      .exhaustive();
}
