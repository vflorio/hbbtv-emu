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
import Hls, { type ErrorData, ErrorTypes } from "hls.js";
import type { HLSConfig } from ".";

type Listener = (event: PlayerEngineEvent) => void;

const snapshotOf = (video: HTMLVideoElement): PlaybackSnapshot => ({
  currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
  duration: Number.isFinite(video.duration) ? video.duration : 0,
  buffered: getBufferedRanges(video),
  playbackRate: Number.isFinite(video.playbackRate) ? video.playbackRate : 1,
  paused: video.paused,
});

export class HLSAdapter implements RuntimeAdapter {
  readonly type = "hls" as const;
  readonly name = "HLS.js";

  private video: HTMLVideoElement | null = null;
  private hls: Hls | null = null;
  private url: string | null = null;
  private listeners = new Set<Listener>();
  private previousLevel: number | null = null;
  private retryCount = new Map<string, number>();

  constructor(private readonly config: HLSConfig = {}) {}

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

      if (!Hls.isSupported()) {
        this.emit({
          _tag: "Engine/Error",
          kind: "media",
          message: "HLS.js is not supported in this browser",
        })();
        return;
      }

      this.hls = new Hls({
        autoStartLoad: true,
        ...this.config.hlsConfig,
        debug: this.config.debug,
        startLevel: this.config.startLevel,
      });

      this.hls.attachMedia(videoElement);

      // HLS.js events
      this.hls.on(Hls.Events.MANIFEST_LOADING, this.onManifestLoading);
      this.hls.on(Hls.Events.MANIFEST_PARSED, this.onManifestParsed);
      this.hls.on(Hls.Events.LEVEL_SWITCHED, this.onLevelSwitched);
      this.hls.on(Hls.Events.LEVEL_SWITCHING, this.onLevelSwitching);
      this.hls.on(Hls.Events.FRAG_LOADING, this.onFragLoading);
      this.hls.on(Hls.Events.ERROR, this.onHlsError);

      // Video element events
      videoElement.addEventListener("loadedmetadata", this.onLoadedMetadata);
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
      if (!this.video || !this.hls) {
        return E.left({
          _tag: "AdapterError/VideoElementNotMounted",
          message: "Video element not mounted",
        });
      }
      try {
        this.url = url;
        this.hls.loadSource(url);
        return E.right(undefined);
      } catch (error) {
        return E.left({
          _tag: "AdapterError/LoadFailed",
          message: error instanceof Error ? error.message : "Failed to load HLS source",
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
    if (!this.video || !this.hls) {
      return E.right(undefined);
    }
    try {
      const video = this.video;
      const hls = this.hls;

      // Remove HLS.js events
      hls.off(Hls.Events.MANIFEST_LOADING, this.onManifestLoading);
      hls.off(Hls.Events.MANIFEST_PARSED, this.onManifestParsed);
      hls.off(Hls.Events.LEVEL_SWITCHED, this.onLevelSwitched);
      hls.off(Hls.Events.LEVEL_SWITCHING, this.onLevelSwitching);
      hls.off(Hls.Events.FRAG_LOADING, this.onFragLoading);
      hls.off(Hls.Events.ERROR, this.onHlsError);

      // Remove video events
      video.removeEventListener("loadedmetadata", this.onLoadedMetadata);
      video.removeEventListener("timeupdate", this.onTimeUpdate);
      video.removeEventListener("playing", this.onPlaying);
      video.removeEventListener("pause", this.onPause);
      video.removeEventListener("waiting", this.onWaiting);
      video.removeEventListener("ended", this.onEnded);
      video.removeEventListener("seeked", this.onSeeked);
      video.removeEventListener("volumechange", this.onVolumeChange);
      video.removeEventListener("error", this.onError);

      hls.destroy();
      video.pause();

      this.video = null;
      this.hls = null;
      this.url = null;

      return E.right(undefined);
    } catch (error) {
      return E.left({
        _tag: "AdapterError/DestroyFailed",
        message: error instanceof Error ? error.message : "Failed to destroy HLS adapter",
        cause: error,
      });
    }
  };

  private onManifestLoading = () => {
    if (!this.url) return;
    this.emit({
      _tag: "Engine/HLS/ManifestLoading",
      url: this.url,
    })();
  };

  private onManifestParsed = () => {
    if (!this.video || !this.url || !this.hls) return;

    // Extract variant information from HLS.js levels
    const variants = this.hls.levels.map((level) => ({
      bandwidth: level.bitrate,
      resolution: { width: level.width || 0, height: level.height || 0 },
      codecs: level.videoCodec || level.audioCodec || "unknown",
      url: level.url[0] || "",
      frameRate: level.frameRate,
    }));

    this.emit({
      _tag: "Engine/HLS/ManifestParsed",
      url: this.url,
      variants,
      duration: Number.isFinite(this.video.duration) ? this.video.duration : 0,
    })();

    // Also emit standard MetadataLoaded for compatibility
    this.emit({
      _tag: "Engine/MetadataLoaded",
      playbackType: this.type,
      url: this.url,
      duration: Number.isFinite(this.video.duration) ? this.video.duration : 0,
      width: this.video.videoWidth,
      height: this.video.videoHeight,
    })();
  };

  private onLevelSwitched = (_event: string, data: any) => {
    if (!this.hls) return;

    const level = this.hls.levels[data.level];
    if (!level) return;

    const variant = {
      bandwidth: level.bitrate,
      resolution: { width: level.width || 0, height: level.height || 0 },
      codecs: level.videoCodec || level.audioCodec || "unknown",
      url: level.url[0] || "",
      frameRate: level.frameRate,
    };

    this.emit({
      _tag: "Engine/HLS/VariantSelected",
      variant,
      bandwidth: level.bitrate,
      resolution: { width: level.width || 0, height: level.height || 0 },
    })();

    this.previousLevel = data.level;
  };

  private onLevelSwitching = (_event: string, data: any) => {
    if (!this.hls || this.previousLevel === null) return;

    const fromLevel = this.hls.levels[this.previousLevel];
    const toLevel = this.hls.levels[data.level];
    if (!fromLevel || !toLevel) return;

    const fromVariant = {
      bandwidth: fromLevel.bitrate,
      resolution: { width: fromLevel.width || 0, height: fromLevel.height || 0 },
      codecs: fromLevel.videoCodec || fromLevel.audioCodec || "unknown",
      url: fromLevel.url[0] || "",
      frameRate: fromLevel.frameRate,
    };

    const toVariant = {
      bandwidth: toLevel.bitrate,
      resolution: { width: toLevel.width || 0, height: toLevel.height || 0 },
      codecs: toLevel.videoCodec || toLevel.audioCodec || "unknown",
      url: toLevel.url[0] || "",
      frameRate: toLevel.frameRate,
    };

    this.emit({
      _tag: "Engine/HLS/AdaptiveSwitching",
      fromVariant,
      toVariant,
      reason: "bandwidth", // HLS.js switching is always ABR-based
    })();
  };

  private onFragLoading = (_event: string, data: any) => {
    if (!this.video || !data.frag) return;

    this.emit({
      _tag: "Engine/HLS/SegmentLoading",
      segmentIndex: data.frag.sn,
      totalSegments: this.hls?.levels[this.hls.currentLevel]?.details?.fragments.length || 0,
      currentTime: this.video.currentTime,
    })();
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

  private onHlsError = (_event: string, data: ErrorData) => {
    if (!data.fatal) return;

    const url = this.url ?? "unknown";

    // Handle specific error types - check details string for manifest errors
    if (
      data.type === ErrorTypes.NETWORK_ERROR &&
      (data.details.includes("manifest") || data.details.includes("Manifest"))
    ) {
      const retryKey = `manifest:${url}`;
      const currentRetry = this.retryCount.get(retryKey) || 0;

      this.emit({
        _tag: "Engine/HLS/ManifestParseError",
        url,
        retryCount: currentRetry,
        message: `HLS manifest error: ${data.details}`,
        cause: data,
      })();

      this.retryCount.set(retryKey, currentRetry + 1);

      // Attempt recovery
      if (this.hls && currentRetry < 3) {
        this.hls.loadSource(url);
      }
    } else if (data.type === ErrorTypes.NETWORK_ERROR && data.details.includes("frag")) {
      const fragSn = typeof data.frag?.sn === "number" ? data.frag.sn : 0;
      const fragUrl = data.frag?.url || "unknown";
      const retryKey = `frag:${fragUrl}`;
      const currentRetry = this.retryCount.get(retryKey) || 0;

      this.emit({
        _tag: "Engine/HLS/SegmentLoadError",
        segmentIndex: fragSn,
        segmentUrl: fragUrl,
        retryCount: currentRetry,
        message: `HLS segment error: ${data.details}`,
        cause: data,
      })();

      this.retryCount.set(retryKey, currentRetry + 1);

      // Attempt recovery
      if (this.hls && currentRetry < 3) {
        this.hls.startLoad();
      }
    } else {
      // Generic HLS error
      this.emit({
        _tag: "Engine/Error",
        kind: "media",
        message: `HLS ${data.type} error: ${data.details}`,
        url: this.url ?? undefined,
        cause: data,
      })();
    }
  };
}

const getBufferedRanges = (video: HTMLVideoElement) => {
  const ranges: { start: number; end: number }[] = [];
  for (let i = 0; i < video.buffered.length; i++) {
    ranges.push({ start: video.buffered.start(i), end: video.buffered.end(i) });
  }
  return ranges;
};
