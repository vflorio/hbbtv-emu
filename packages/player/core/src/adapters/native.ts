import type * as IO from "fp-ts/IO";
import type * as T from "fp-ts/Task";
import type { NativeConfig } from "../../playback/types";
import type { PlaybackSnapshot, PlayerEngineEvent, UnsubscribeFn } from "../runtime/types";

type Listener = (event: PlayerEngineEvent) => void;

const snapshotOf = (video: HTMLVideoElement): PlaybackSnapshot => ({
  currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
  duration: Number.isFinite(video.duration) ? video.duration : 0,
  buffered: getBufferedRanges(video),
  playbackRate: Number.isFinite(video.playbackRate) ? video.playbackRate : 1,
  paused: video.paused,
});

export class NativeAdapter {
  readonly type = "native" as const;
  readonly name = "Native HTML5";

  private video: HTMLVideoElement | null = null;
  private url: string | null = null;
  private listeners = new Set<Listener>();

  constructor(private readonly config: NativeConfig = {}) {}

  subscribe =
    (listener: Listener): IO.IO<UnsubscribeFn> =>
    () => {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    };

  private emit =
    (event: PlayerEngineEvent): IO.IO<void> =>
    () => {
      for (const listener of this.listeners) listener(event);
    };

  mount =
    (videoElement: HTMLVideoElement): IO.IO<void> =>
    () => {
      this.video = videoElement;

      if (this.config.preload) videoElement.preload = this.config.preload;
      if (this.config.crossOrigin) videoElement.crossOrigin = this.config.crossOrigin;
      if (this.config.autoplay !== undefined) videoElement.autoplay = this.config.autoplay;

      videoElement.addEventListener("loadedmetadata", this.onLoadedMetadata);
      videoElement.addEventListener("timeupdate", this.onTimeUpdate);
      videoElement.addEventListener("playing", this.onPlaying);
      videoElement.addEventListener("pause", this.onPause);
      videoElement.addEventListener("waiting", this.onWaiting);
      videoElement.addEventListener("ended", this.onEnded);
      videoElement.addEventListener("seeked", this.onSeeked);
      videoElement.addEventListener("error", this.onError);

      this.emit({ _tag: "Engine/Mounted" })();
    };

  load =
    (url: string): T.Task<void> =>
    async () => {
      if (!this.video) throw new Error("Video element not mounted");
      this.url = url;
      this.video.src = url;
      this.video.load();
    };

  play: T.Task<void> = async () => {
    if (!this.video) throw new Error("Video element not mounted");
    await this.video.play();
  };

  pause: T.Task<void> = async () => {
    if (!this.video) throw new Error("Video element not mounted");
    this.video.pause();
  };

  seek =
    (time: number): T.Task<void> =>
    async () => {
      if (!this.video) throw new Error("Video element not mounted");
      this.video.currentTime = time;
    };

  destroy: T.Task<void> = async () => {
    if (!this.video) return;
    const video = this.video;

    video.removeEventListener("loadedmetadata", this.onLoadedMetadata);
    video.removeEventListener("timeupdate", this.onTimeUpdate);
    video.removeEventListener("playing", this.onPlaying);
    video.removeEventListener("pause", this.onPause);
    video.removeEventListener("waiting", this.onWaiting);
    video.removeEventListener("ended", this.onEnded);
    video.removeEventListener("seeked", this.onSeeked);
    video.removeEventListener("error", this.onError);

    video.pause();
    video.removeAttribute("src");
    video.load();

    this.video = null;
    this.url = null;
  };

  private onLoadedMetadata = () => {
    if (!this.video || !this.url) return;
    this.emit({
      _tag: "Engine/MetadataLoaded",
      url: this.url,
      duration: Number.isFinite(this.video.duration) ? this.video.duration : 0,
      width: this.video.videoWidth,
      height: this.video.videoHeight,
    })();
  };

  private onTimeUpdate = () => {
    if (!this.video) return;
    this.emit({ _tag: "Engine/TimeUpdated", snapshot: snapshotOf(this.video) })();
  };

  private onPlaying = () => {
    if (!this.video) return;
    this.emit({ _tag: "Engine/Playing", snapshot: snapshotOf(this.video) })();
  };

  private onPause = () => {
    if (!this.video) return;
    this.emit({ _tag: "Engine/Paused", snapshot: snapshotOf(this.video) })();
  };

  private onWaiting = () => {
    if (!this.video) return;
    this.emit({ _tag: "Engine/Waiting", snapshot: snapshotOf(this.video) })();
  };

  private onEnded = () => {
    if (!this.video) return;
    this.emit({ _tag: "Engine/Ended", snapshot: snapshotOf(this.video) })();
  };

  private onSeeked = () => {
    if (!this.video) return;
    this.emit({ _tag: "Engine/Seeked", snapshot: snapshotOf(this.video) })();
  };

  private onError = () => {
    if (!this.video) return;
    const err = this.video.error;
    this.emit({
      _tag: "Engine/Error",
      kind: "media",
      message: err ? `MediaError ${err.code}` : "Unknown media error",
      url: this.url ?? undefined,
      cause: err ?? undefined,
    })();
  };
}

const getBufferedRanges = (video: HTMLVideoElement) => {
  const ranges: { start: number; end: number }[] = [];
  for (let i = 0; i < video.buffered.length; i++) {
    ranges.push({ start: video.buffered.start(i), end: video.buffered.end(i) });
  }
  return ranges;
};
