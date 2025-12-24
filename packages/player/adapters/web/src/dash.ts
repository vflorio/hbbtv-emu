import type {
  AdapterError,
  PlaybackSnapshot,
  PlayerEngineEvent,
  RuntimeAdapter,
  UnsubscribeFn,
} from "@hbb-emu/player-runtime";
import * as dashjs from "dashjs";
import * as E from "fp-ts/Either";
import type * as IO from "fp-ts/IO";
import type * as TE from "fp-ts/TaskEither";
import type { DASHConfig } from ".";

type Listener = (event: PlayerEngineEvent) => void;

const snapshotOf = (video: HTMLVideoElement): PlaybackSnapshot => ({
  currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
  duration: Number.isFinite(video.duration) ? video.duration : 0,
  buffered: getBufferedRanges(video),
  playbackRate: Number.isFinite(video.playbackRate) ? video.playbackRate : 1,
  paused: video.paused,
});

export class DASHAdapter implements RuntimeAdapter {
  readonly type = "dash" as const;
  readonly name = "dash.js";

  private video: HTMLVideoElement | null = null;
  private player: dashjs.MediaPlayerClass | null = null;
  private url: string | null = null;
  private listeners = new Set<Listener>();
  private previousQuality: { video?: number; audio?: number } = {};
  private retryCount = new Map<string, number>();

  constructor(private readonly config: DASHConfig = {}) {}

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

      this.player = dashjs.MediaPlayer().create();
      this.player.initialize(videoElement, undefined, false);

      // Apply configuration
      if (this.config.debug !== undefined) {
        this.player.updateSettings({
          debug: {
            logLevel: this.config.debug ? dashjs.LogLevel.LOG_LEVEL_DEBUG : dashjs.LogLevel.LOG_LEVEL_WARNING,
          },
        });
      }

      if (this.config.dashSettings) {
        this.player.updateSettings(this.config.dashSettings);
      }

      // DASH.js events
      this.player.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, this.onManifestLoading);
      this.player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, this.onStreamInitialized);
      this.player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_REQUESTED, this.onQualityChangeRequested);
      this.player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, this.onQualityChangeRendered);
      this.player.on(dashjs.MediaPlayer.events.FRAGMENT_LOADING_STARTED, this.onFragmentLoadingStarted);
      this.player.on(dashjs.MediaPlayer.events.FRAGMENT_LOADING_COMPLETED, this.onFragmentLoadingCompleted);
      this.player.on(dashjs.MediaPlayer.events.ERROR, this.onDashError);

      // Video element events
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
    (url: string): TE.TaskEither<AdapterError, void> =>
    async () => {
      if (!this.video || !this.player) {
        return E.left({
          _tag: "AdapterError/VideoElementNotMounted",
          message: "Video element not mounted",
        });
      }
      try {
        this.url = url;
        this.player.attachSource(url);
        return E.right(undefined);
      } catch (error) {
        return E.left({
          _tag: "AdapterError/LoadFailed",
          message: error instanceof Error ? error.message : "Failed to load DASH source",
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

  destroy: TE.TaskEither<AdapterError, void> = async () => {
    if (!this.video || !this.player) {
      return E.right(undefined);
    }
    try {
      const video = this.video;
      const player = this.player;

      // Remove DASH.js events
      player.off(dashjs.MediaPlayer.events.MANIFEST_LOADED, this.onManifestLoading);
      player.off(dashjs.MediaPlayer.events.STREAM_INITIALIZED, this.onStreamInitialized);
      player.off(dashjs.MediaPlayer.events.QUALITY_CHANGE_REQUESTED, this.onQualityChangeRequested);
      player.off(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, this.onQualityChangeRendered);
      player.off(dashjs.MediaPlayer.events.FRAGMENT_LOADING_STARTED, this.onFragmentLoadingStarted);
      player.off(dashjs.MediaPlayer.events.FRAGMENT_LOADING_COMPLETED, this.onFragmentLoadingCompleted);
      player.off(dashjs.MediaPlayer.events.ERROR, this.onDashError);

      // Remove video events
      video.removeEventListener("loadedmetadata", this.onLoadedMetadata);
      video.removeEventListener("timeupdate", this.onTimeUpdate);
      video.removeEventListener("playing", this.onPlaying);
      video.removeEventListener("pause", this.onPause);
      video.removeEventListener("waiting", this.onWaiting);
      video.removeEventListener("ended", this.onEnded);
      video.removeEventListener("seeked", this.onSeeked);
      video.removeEventListener("error", this.onError);

      player.reset();
      video.pause();

      this.video = null;
      this.player = null;
      this.url = null;

      return E.right(undefined);
    } catch (error) {
      return E.left({
        _tag: "AdapterError/DestroyFailed",
        message: error instanceof Error ? error.message : "Failed to destroy DASH adapter",
        cause: error,
      });
    }
  };

  private onManifestLoading = () => {
    if (!this.url) return;
    this.emit({
      _tag: "Engine/DASH/MPDLoading",
      url: this.url,
    })();
  };

  private onStreamInitialized = () => {
    if (!this.video || !this.url || !this.player) return;

    // Extract adaptation sets information
    const videoTracks = this.player.getTracksFor("video") || [];
    const audioTracks = this.player.getTracksFor("audio") || [];
    const textTracks = this.player.getTracksFor("text") || [];

    const adaptationSets = [
      ...videoTracks.map((track: any) => ({
        id: track.id || "video",
        contentType: "video" as const,
        mimeType: track.mimeType || "unknown",
        representationCount: track.bitrateList?.length || 0,
      })),
      ...audioTracks.map((track: any) => ({
        id: track.id || "audio",
        contentType: "audio" as const,
        mimeType: track.mimeType || "unknown",
        representationCount: track.bitrateList?.length || 0,
      })),
      ...textTracks.map((track: any) => ({
        id: track.id || "text",
        contentType: "text" as const,
        mimeType: track.mimeType || "unknown",
        representationCount: 1,
      })),
    ];

    const isDynamic = this.player.isDynamic();

    this.emit({
      _tag: "Engine/DASH/MPDParsed",
      url: this.url,
      adaptationSets,
      duration: Number.isFinite(this.video.duration) ? this.video.duration : 0,
      isDynamic,
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

  private onQualityChangeRequested = (event: any) => {
    if (!this.player) return;

    const mediaType = event.mediaType;
    const oldQuality = event.oldQuality;
    const newQuality = event.newQuality;

    if (mediaType === "video" && oldQuality !== undefined && newQuality !== undefined) {
      try {
        // Emit with basic info
        this.emit({
          _tag: "Engine/DASH/QualitySwitching",
          fromRepresentation: {
            id: `${oldQuality}`,
            bandwidth: 0,
            codecs: "unknown",
          },
          toRepresentation: {
            id: `${newQuality}`,
            bandwidth: 0,
            codecs: "unknown",
          },
          reason: event.reason || "abr",
        })();
      } catch {
        // Ignore if quality info not available
      }
    }
  };

  private onQualityChangeRendered = (event: any) => {
    if (!this.player) return;

    const mediaType = event.mediaType;
    const newQuality = event.newQuality;

    if (mediaType === "video" && newQuality !== undefined) {
      try {
        // Emit with basic info
        this.emit({
          _tag: "Engine/DASH/RepresentationSelected",
          representation: {
            id: `${newQuality}`,
            bandwidth: 0,
            codecs: "unknown",
          },
          bandwidth: 0,
          resolution: { width: this.video?.videoWidth || 0, height: this.video?.videoHeight || 0 },
        })();

        this.previousQuality.video = newQuality;
      } catch {
        // Ignore if quality info not available
      }
    }
  };

  private fragmentDownloadProgress = new Map<string, { loaded: number; total: number }>();

  private onFragmentLoadingStarted = (event: any) => {
    const request = event.request;
    if (!request) return;

    const key = `${request.mediaType}:${request.index}`;
    this.fragmentDownloadProgress.set(key, { loaded: 0, total: 0 });
  };

  private onFragmentLoadingCompleted = (event: any) => {
    const request = event.request;
    if (!request) return;

    const key = `${request.mediaType}:${request.index}`;
    const bytesTotal = request.bytesTotal || 0;

    this.emit({
      _tag: "Engine/DASH/SegmentDownloading",
      segmentIndex: request.index || 0,
      mediaType: request.mediaType === "video" ? "video" : "audio",
      bytesLoaded: bytesTotal,
      bytesTotal,
    })();

    this.fragmentDownloadProgress.delete(key);
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

  private onDashError = (event: any) => {
    const error = event.error;
    if (!error) return;

    const url = this.url ?? "unknown";

    // Check error code to determine type
    const errorCode = error.code;
    const errorMessage = error.message || `DASH error: ${errorCode}`;

    // MPD/Manifest errors (codes 25-27)
    if (errorCode >= 25 && errorCode <= 27) {
      const retryKey = `mpd:${url}`;
      const currentRetry = this.retryCount.get(retryKey) || 0;

      this.emit({
        _tag: "Engine/DASH/MPDParseError",
        url,
        retryCount: currentRetry,
        message: errorMessage,
        cause: error,
      })();

      this.retryCount.set(retryKey, currentRetry + 1);

      // Attempt recovery for network errors
      if (this.player && currentRetry < 3 && errorCode === 27) {
        setTimeout(
          () => {
            if (this.player && this.url) {
              this.player.attachSource(this.url);
            }
          },
          1000 * (currentRetry + 1),
        );
      }
    }
    // Fragment/Segment errors (codes 21-24)
    else if (errorCode >= 21 && errorCode <= 24) {
      const mediaType = error.data?.mediaType || "video";
      const segmentIndex = error.data?.index || 0;
      const retryKey = `segment:${mediaType}:${segmentIndex}`;
      const currentRetry = this.retryCount.get(retryKey) || 0;

      this.emit({
        _tag: "Engine/DASH/SegmentDownloadError",
        segmentIndex,
        mediaType: mediaType === "video" ? "video" : "audio",
        retryCount: currentRetry,
        message: errorMessage,
        cause: error,
      })();

      this.retryCount.set(retryKey, currentRetry + 1);
    }
    // Generic DASH error
    else {
      this.emit({
        _tag: "Engine/Error",
        kind: "media",
        message: errorMessage,
        url: this.url ?? undefined,
        cause: error,
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
