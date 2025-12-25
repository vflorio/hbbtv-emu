import type {
  AdapterError,
  PlaybackSnapshot,
  PlayerEngineEvent,
  RuntimeAdapter,
  UnsubscribeFn,
} from "@hbb-emu/player-runtime";
import * as E from "fp-ts/Either";
import type * as IO from "fp-ts/IO";
import type * as TE from "fp-ts/TaskEither";
import type { NativeConfig } from ".";

type Listener = (event: PlayerEngineEvent) => void;

const snapshotOf = (video: HTMLVideoElement): PlaybackSnapshot => ({
  currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
  duration: Number.isFinite(video.duration) ? video.duration : 0,
  buffered: getBufferedRanges(video),
  playbackRate: Number.isFinite(video.playbackRate) ? video.playbackRate : 1,
  paused: video.paused,
});

export class NativeAdapter implements RuntimeAdapter {
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
      videoElement.addEventListener("progress", this.onProgress);
      videoElement.addEventListener("canplaythrough", this.onCanPlayThrough);
      videoElement.addEventListener("timeupdate", this.onTimeUpdate);
      videoElement.addEventListener("playing", this.onPlaying);
      videoElement.addEventListener("pause", this.onPause);
      videoElement.addEventListener("waiting", this.onWaiting);
      videoElement.addEventListener("ended", this.onEnded);
      videoElement.addEventListener("seeked", this.onSeeked);
      videoElement.addEventListener("volumechange", this.onVolumeChange);
      videoElement.addEventListener("error", this.onError);

      this.emit({ _tag: "Engine/Mounted" })();
    };

  load =
    (url: string): TE.TaskEither<AdapterError, void> =>
    async () => {
      if (!this.video) {
        return E.left({
          _tag: "AdapterError/VideoElementNotMounted",
          message: "Video element not mounted",
        });
      }
      try {
        this.url = url;
        this.video.src = url;
        this.video.load();
        return E.right(undefined);
      } catch (error) {
        return E.left({
          _tag: "AdapterError/LoadFailed",
          message: error instanceof Error ? error.message : "Failed to load source",
          url,
          cause: error,
        });
      }
    };

  play: TE.TaskEither<AdapterError, void> = async () => {
    if (!this.video) {
      return E.left({
        _tag: "AdapterError/VideoElementNotMounted",
        message: "Video element not mounted",
      });
    }
    try {
      await this.video.play();
      return E.right(undefined);
    } catch (error) {
      // Check if error is due to autoplay policy (user interaction required)
      if (error instanceof Error && error.name === "NotAllowedError") {
        return E.left({
          _tag: "AdapterError/AutoplayBlocked",
          message: "Autoplay was blocked by browser policy",
          cause: error,
        });
      }
      return E.left({
        _tag: "AdapterError/PlayFailed",
        message: error instanceof Error ? error.message : "Failed to play",
        cause: error,
      });
    }
  };

  pause: TE.TaskEither<AdapterError, void> = async () => {
    if (!this.video) {
      return E.left({
        _tag: "AdapterError/VideoElementNotMounted",
        message: "Video element not mounted",
      });
    }
    try {
      this.video.pause();
      return E.right(undefined);
    } catch (error) {
      return E.left({
        _tag: "AdapterError/PauseFailed",
        message: error instanceof Error ? error.message : "Failed to pause",
        cause: error,
      });
    }
  };

  seek =
    (time: number): TE.TaskEither<AdapterError, void> =>
    async () => {
      if (!this.video) {
        return E.left({
          _tag: "AdapterError/VideoElementNotMounted",
          message: "Video element not mounted",
        });
      }
      try {
        this.video.currentTime = time;
        return E.right(undefined);
      } catch (error) {
        return E.left({
          _tag: "AdapterError/SeekFailed",
          message: error instanceof Error ? error.message : "Failed to seek",
          time,
          cause: error,
        });
      }
    };

  setVolume =
    (volume: number): TE.TaskEither<AdapterError, void> =>
    async () => {
      if (!this.video) {
        return E.left({
          _tag: "AdapterError/VideoElementNotMounted",
          message: "Video element not mounted",
        });
      }
      try {
        this.video.volume = Math.max(0, Math.min(1, volume));
        return E.right(undefined);
      } catch (error) {
        return E.left({
          _tag: "AdapterError/PlayFailed",
          message: error instanceof Error ? error.message : "Failed to set volume",
          cause: error,
        });
      }
    };

  setMuted =
    (muted: boolean): TE.TaskEither<AdapterError, void> =>
    async () => {
      if (!this.video) {
        return E.left({
          _tag: "AdapterError/VideoElementNotMounted",
          message: "Video element not mounted",
        });
      }
      try {
        this.video.muted = muted;
        return E.right(undefined);
      } catch (error) {
        return E.left({
          _tag: "AdapterError/PlayFailed",
          message: error instanceof Error ? error.message : "Failed to set muted",
          cause: error,
        });
      }
    };

  destroy: TE.TaskEither<AdapterError, void> = async () => {
    if (!this.video) {
      return E.right(undefined);
    }
    try {
      const video = this.video;

      video.removeEventListener("loadedmetadata", this.onLoadedMetadata);
      video.removeEventListener("progress", this.onProgress);
      video.removeEventListener("canplaythrough", this.onCanPlayThrough);
      video.removeEventListener("timeupdate", this.onTimeUpdate);
      video.removeEventListener("playing", this.onPlaying);
      video.removeEventListener("pause", this.onPause);
      video.removeEventListener("waiting", this.onWaiting);
      video.removeEventListener("ended", this.onEnded);
      video.removeEventListener("seeked", this.onSeeked);
      video.removeEventListener("volumechange", this.onVolumeChange);
      video.removeEventListener("error", this.onError);

      video.pause();
      video.removeAttribute("src");
      video.load();

      this.video = null;
      this.url = null;

      return E.right(undefined);
    } catch (error) {
      return E.left({
        _tag: "AdapterError/DestroyFailed",
        message: error instanceof Error ? error.message : "Failed to destroy adapter",
        cause: error,
      });
    }
  };

  private onLoadedMetadata = () => {
    if (!this.video || !this.url) return;
    this.emit({
      _tag: "Engine/MetadataLoaded",
      playbackType: this.type,
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

  private onVolumeChange = () => {
    if (!this.video) return;
    this.emit({ _tag: "Engine/VolumeChanged", volume: this.video.volume })();
    this.emit({ _tag: "Engine/MutedChanged", muted: this.video.muted })();
  };

  private canPlayThrough = false;

  private onProgress = () => {
    if (!this.video || !this.url) return;

    const buffered = this.video.buffered;
    const duration = this.video.duration;

    let bytesLoaded = 0;
    let bytesTotal = 0;

    // Estimate bytes based on buffered time ranges
    if (buffered.length > 0 && Number.isFinite(duration) && duration > 0) {
      for (let i = 0; i < buffered.length; i++) {
        bytesLoaded += buffered.end(i) - buffered.start(i);
      }
      bytesTotal = duration;
    }

    this.emit({
      _tag: "Engine/Native/ProgressiveLoading",
      url: this.url,
      bytesLoaded,
      bytesTotal,
      canPlayThrough: this.canPlayThrough,
    })();
  };

  private onCanPlayThrough = () => {
    this.canPlayThrough = true;
    if (this.video && this.url) {
      this.onProgress();
    }
  };

  private onError = () => {
    if (!this.video) return;
    const err = this.video.error;

    if (!err) {
      this.emit({
        _tag: "Engine/Error",
        kind: "unknown",
        message: "Unknown media error",
        url: this.url ?? undefined,
      })();
      return;
    }

    // Map MediaError codes to specific error kinds
    let kind: "decode" | "network" | "not-supported" | "media" = "media";
    let message = "Media error";

    switch (err.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        kind = "network";
        message = "Media loading aborted";
        break;
      case MediaError.MEDIA_ERR_NETWORK:
        kind = "network";
        message = "Network error while loading media";
        break;
      case MediaError.MEDIA_ERR_DECODE:
        kind = "decode";
        message = "Media decode error";
        break;
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        kind = "not-supported";
        message = "Media format not supported";
        break;
      default:
        message = `MediaError ${err.code}`;
    }

    this.emit({
      _tag: "Engine/Error",
      kind,
      message: err.message || message,
      url: this.url ?? undefined,
      codec: kind === "decode" ? "unknown" : undefined,
      cause: err,
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
