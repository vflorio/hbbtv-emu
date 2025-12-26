import { addEventListener } from "@hbb-emu/core";
import type { AdapterError, RuntimeAdapter, UnsubscribeFn } from "@hbb-emu/player-runtime";
import * as dashjs from "dashjs";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import type { DASHConfig } from ".";
import { emit, snapshotOf, type VideoEventListener } from "./utils";

export class DASHAdapter implements RuntimeAdapter {
  readonly type = "dash" as const;
  readonly name = "dash.js";

  private video: HTMLVideoElement | null = null;
  private player: dashjs.MediaPlayerClass | null = null;
  private url: string | null = null;
  private readonly listeners = new Set<VideoEventListener>();
  private previousQuality: { video?: number; audio?: number } = {};
  private retryCount = new Map<string, number>();
  private fragmentDownloadProgress = new Map<string, { loaded: number; total: number }>();

  private cleanVideoElementEventListener: IO.IO<void> = IO.of(undefined);
  private cleanDashEventListener: IO.IO<void> = IO.of(undefined);

  constructor(private readonly config: DASHConfig = {}) {}

  mount =
    (videoElement: HTMLVideoElement): IO.IO<void> =>
    () => {
      this.video = videoElement;

      const player = dashjs.MediaPlayer().create();
      player.initialize(videoElement, undefined, false);

      const updateDashConfig = pipe(
        IO.Do,
        IO.flatMap(() =>
          pipe(
            O.fromNullable(this.config.debug),
            O.match(
              () => IO.of(undefined),
              (debug) => () => {
                player.updateSettings({
                  debug: {
                    logLevel: debug ? dashjs.LogLevel.LOG_LEVEL_DEBUG : dashjs.LogLevel.LOG_LEVEL_WARNING,
                  },
                });
              },
            ),
          ),
        ),
        IO.flatMap(() =>
          pipe(
            O.fromNullable(this.config.dashSettings),
            O.match(
              () => IO.of(undefined),
              (settings) => () => player.updateSettings(settings),
            ),
          ),
        ),
      );

      const setupDashEventListeners = pipe(
        RA.fromArray([
          () => {
            player.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, this.onManifestLoading);
            return () => player.off(dashjs.MediaPlayer.events.MANIFEST_LOADED, this.onManifestLoading);
          },
          () => {
            player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, this.onStreamInitialized);
            return () => player.off(dashjs.MediaPlayer.events.STREAM_INITIALIZED, this.onStreamInitialized);
          },
          () => {
            player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_REQUESTED, this.onQualityChangeRequested);
            return () => player.off(dashjs.MediaPlayer.events.QUALITY_CHANGE_REQUESTED, this.onQualityChangeRequested);
          },
          () => {
            player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, this.onQualityChangeRendered);
            return () => player.off(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, this.onQualityChangeRendered);
          },
          () => {
            player.on(dashjs.MediaPlayer.events.FRAGMENT_LOADING_STARTED, this.onFragmentLoadingStarted);
            return () => player.off(dashjs.MediaPlayer.events.FRAGMENT_LOADING_STARTED, this.onFragmentLoadingStarted);
          },
          () => {
            player.on(dashjs.MediaPlayer.events.FRAGMENT_LOADING_COMPLETED, this.onFragmentLoadingCompleted);
            return () =>
              player.off(dashjs.MediaPlayer.events.FRAGMENT_LOADING_COMPLETED, this.onFragmentLoadingCompleted);
          },
          () => {
            player.on(dashjs.MediaPlayer.events.ERROR, this.onDashError);
            return () => player.off(dashjs.MediaPlayer.events.ERROR, this.onDashError);
          },
        ]),
        RA.traverse(IO.Applicative)((addListener) => addListener()),
        IO.map((removeEventListeners) =>
          pipe(
            removeEventListeners,
            RA.traverse(IO.Applicative)((remove) => IO.of(remove)),
            IO.asUnit,
          ),
        ),
      );

      const setupEventListeners = pipe(
        RA.fromArray([
          addEventListener(videoElement)("loadedmetadata")(this.onLoadedMetadata),
          addEventListener(videoElement)("timeupdate")(this.onTimeUpdate),
          addEventListener(videoElement)("playing")(this.onPlaying),
          addEventListener(videoElement)("pause")(this.onPause),
          addEventListener(videoElement)("waiting")(this.onWaiting),
          addEventListener(videoElement)("ended")(this.onEnded),
          addEventListener(videoElement)("seeked")(this.onSeeked),
          addEventListener(videoElement)("volumechange")(this.onVolumeChange),
          addEventListener(videoElement)("error")(this.onError),
        ]),
        RA.traverse(IO.Applicative)((addListener) => addListener),
        IO.map((removeEventListeners) =>
          pipe(
            removeEventListeners,
            RA.traverse(IO.Applicative)((remove) => remove),
            IO.asUnit,
          ),
        ),
      );

      return pipe(
        IO.Do,
        IO.flatMap(() => updateDashConfig),
        IO.flatMap(() =>
          pipe(
            setupDashEventListeners,
            IO.flatMap((clean) => () => {
              this.cleanDashEventListener = clean;
            }),
          ),
        ),
        IO.flatMap(() =>
          pipe(
            setupEventListeners,
            IO.flatMap((clean) => () => {
              this.cleanVideoElementEventListener = clean;
              this.player = player;
            }),
          ),
        ),
        IO.flatMap(() => emit(this.listeners)({ _tag: "Engine/Mounted" })),
      );
    };

  private getVideoElement: TE.TaskEither<AdapterError, HTMLVideoElement> = TE.fromEither(
    pipe(
      this.video,
      E.fromNullable({
        _tag: "AdapterError/VideoElementNotMounted" as const,
        message: "Video element not mounted",
      }),
    ),
  );

  private getPlayerInstance: TE.TaskEither<AdapterError, dashjs.MediaPlayerClass> = TE.fromEither(
    pipe(
      this.player,
      E.fromNullable({
        _tag: "AdapterError/VideoElementNotMounted" as const,
        message: "Player not initialized",
      }),
    ),
  );

  subscribe = (listener: VideoEventListener): IO.IO<UnsubscribeFn> =>
    pipe(
      IO.of(this.listeners.add(listener)),
      IO.map(() => IO.of(this.listeners.delete(listener))),
    );

  load = (url: string): TE.TaskEither<AdapterError, void> =>
    pipe(
      this.getPlayerInstance,
      TE.tapIO(() => () => {
        this.url = url;
      }),
      TE.flatMap((player) =>
        pipe(
          E.tryCatch(
            () => {
              player.attachSource(url);
            },
            (error): AdapterError => ({
              _tag: "AdapterError/LoadFailed",
              message: error instanceof Error ? error.message : "Failed to load DASH source",
              url,
              cause: error,
            }),
          ),
          TE.fromEither,
        ),
      ),
    );

  play: TE.TaskEither<AdapterError, void> = pipe(
    this.getVideoElement,
    TE.flatMap((video) =>
      TE.tryCatch(
        () => video.play(),
        (error): AdapterError =>
          match(error)
            .when(
              (error): error is Error => error instanceof Error && error.name === "NotAllowedError",
              (error) => ({
                _tag: "AdapterError/AutoplayBlocked" as const,
                message: "Autoplay was blocked by browser policy",
                cause: error,
              }),
            )
            .otherwise((error) => ({
              _tag: "AdapterError/PlayFailed" as const,
              message: error instanceof Error ? error.message : "Failed to play",
              cause: error,
            })),
      ),
    ),
  );

  pause: TE.TaskEither<AdapterError, void> = pipe(
    this.getVideoElement,
    TE.flatMap((video) =>
      pipe(
        E.tryCatch(
          () => video.pause(),
          (error): AdapterError => ({
            _tag: "AdapterError/PauseFailed",
            message: error instanceof Error ? error.message : "Failed to pause",
            cause: error,
          }),
        ),
        TE.fromEither,
      ),
    ),
  );

  seek = (time: number): TE.TaskEither<AdapterError, void> =>
    pipe(
      this.getVideoElement,
      TE.flatMap((video) =>
        pipe(
          E.tryCatch(
            () => {
              video.currentTime = Math.max(0, Math.min(video.duration, time));
            },
            (error): AdapterError => ({
              _tag: "AdapterError/SeekFailed",
              message: error instanceof Error ? error.message : "Failed to seek",
              cause: error,
              time,
            }),
          ),
          TE.fromEither,
        ),
      ),
    );

  setVolume = (volume: number): TE.TaskEither<AdapterError, void> =>
    pipe(
      this.getVideoElement,
      TE.flatMap((video) =>
        pipe(
          E.tryCatch(
            () => {
              video.volume = Math.max(0, Math.min(1, volume));
            },
            (error): AdapterError => ({
              _tag: "AdapterError/PlayFailed",
              message: error instanceof Error ? error.message : "Failed to set volume",
              cause: error,
            }),
          ),
          TE.fromEither,
        ),
      ),
    );

  setMuted = (muted: boolean): TE.TaskEither<AdapterError, void> =>
    pipe(
      this.getVideoElement,
      TE.flatMap((video) =>
        pipe(
          E.tryCatch(
            () => {
              video.muted = muted;
            },
            (error): AdapterError => ({
              _tag: "AdapterError/PlayFailed",
              message: error instanceof Error ? error.message : "Failed to set muted",
              cause: error,
            }),
          ),
          TE.fromEither,
        ),
      ),
    );

  destroy: TE.TaskEither<AdapterError, void> = pipe(
    TE.fromIO(this.cleanDashEventListener),
    TE.flatMap(() => TE.fromIO(this.cleanVideoElementEventListener)),
    TE.flatMap(() =>
      TE.fromEither(
        E.tryCatch(
          () => {
            if (this.player) {
              this.player.reset();
            }
            if (this.video) {
              this.video.pause();
            }
          },
          (error): AdapterError => ({
            _tag: "AdapterError/DestroyFailed",
            message: error instanceof Error ? error.message : "Failed to destroy DASH adapter",
            cause: error,
          }),
        ),
      ),
    ),
    TE.tapIO(() => () => {
      this.video = null;
      this.player = null;
      this.url = null;
    }),
  );

  // Event Handlers

  private onManifestLoading = pipe(
    O.Do,
    O.apS("url", O.fromNullable(this.url)),
    O.match(
      () => IO.of(undefined),
      ({ url }) =>
        emit(this.listeners)({
          _tag: "Engine/DASH/MPDLoading",
          url,
        }),
    ),
  );

  private onStreamInitialized = pipe(
    O.Do,
    O.apS("video", O.fromNullable(this.video)),
    O.apS("url", O.fromNullable(this.url)),
    O.apS("player", O.fromNullable(this.player)),
    O.match(
      () => IO.of(undefined),
      ({ video, url, player }) =>
        () => {
          const videoTracks = player.getTracksFor("video") || [];
          const audioTracks = player.getTracksFor("audio") || [];
          const textTracks = player.getTracksFor("text") || [];

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

          const isDynamic = player.isDynamic();
          const duration = Number.isFinite(video.duration) ? video.duration : 0;

          pipe(
            emit(this.listeners)({
              _tag: "Engine/DASH/MPDParsed",
              url,
              adaptationSets,
              duration,
              isDynamic,
            }),
            IO.flatMap(() =>
              emit(this.listeners)({
                _tag: "Engine/MetadataLoaded",
                playbackType: this.type,
                url,
                duration,
                width: video.videoWidth,
                height: video.videoHeight,
              }),
            ),
          )();
        },
    ),
  );

  private onQualityChangeRequested = (event: any) =>
    pipe(
      O.Do,
      O.apS("player", O.fromNullable(this.player)),
      O.filter(() => event.mediaType === "video" && event.oldQuality !== undefined && event.newQuality !== undefined),
      O.match(
        () => IO.of(undefined),
        () =>
          emit(this.listeners)({
            _tag: "Engine/DASH/QualitySwitching",
            fromRepresentation: {
              id: `${event.oldQuality}`,
              bandwidth: 0,
              codecs: "unknown",
            },
            toRepresentation: {
              id: `${event.newQuality}`,
              bandwidth: 0,
              codecs: "unknown",
            },
            reason: event.reason || "abr",
          }),
      ),
    )();

  private onQualityChangeRendered = (event: any) =>
    pipe(
      O.Do,
      O.apS("player", O.fromNullable(this.player)),
      O.apS("video", O.fromNullable(this.video)),
      O.filter(() => event.mediaType === "video" && event.newQuality !== undefined),
      O.match(
        () => IO.of(undefined),
        ({ video }) =>
          () => {
            emit(this.listeners)({
              _tag: "Engine/DASH/RepresentationSelected",
              representation: {
                id: `${event.newQuality}`,
                bandwidth: 0,
                codecs: "unknown",
              },
              bandwidth: 0,
              resolution: { width: video.videoWidth || 0, height: video.videoHeight || 0 },
            })();

            this.previousQuality.video = event.newQuality;
          },
      ),
    )();

  private onFragmentLoadingStarted = (event: any) => {
    const request = event.request;
    if (!request) return;

    const key = `${request.mediaType}:${request.index}`;
    this.fragmentDownloadProgress.set(key, { loaded: 0, total: 0 });
  };

  private onFragmentLoadingCompleted = (event: any) =>
    pipe(
      O.Do,
      O.apS("request", O.fromNullable(event.request)),
      O.match(
        () => IO.of(undefined),
        ({ request }) =>
          () => {
            const key = `${request.mediaType}:${request.index}`;
            const bytesTotal = request.bytesTotal || 0;

            emit(this.listeners)({
              _tag: "Engine/DASH/SegmentDownloading",
              segmentIndex: request.index || 0,
              mediaType: request.mediaType === "video" ? "video" : "audio",
              bytesLoaded: bytesTotal,
              bytesTotal,
            })();

            this.fragmentDownloadProgress.delete(key);
          },
      ),
    )();

  private onLoadedMetadata = pipe(
    O.Do,
    O.apS("video", O.fromNullable(this.video)),
    O.apS("url", O.fromNullable(this.url)),
    O.match(
      () => IO.of(undefined),
      ({ video, url }) =>
        emit(this.listeners)({
          _tag: "Engine/MetadataLoaded",
          playbackType: this.type,
          url,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
          width: video.videoWidth,
          height: video.videoHeight,
        }),
    ),
  );

  private onTimeUpdate = pipe(
    O.Do,
    O.apS("video", O.fromNullable(this.video)),
    O.match(
      () => IO.of(undefined),
      ({ video }) => emit(this.listeners)({ _tag: "Engine/TimeUpdated", snapshot: snapshotOf(video) }),
    ),
  );

  private onPlaying = pipe(
    O.Do,
    O.apS("video", O.fromNullable(this.video)),
    O.match(
      () => IO.of(undefined),
      ({ video }) => emit(this.listeners)({ _tag: "Engine/Playing", snapshot: snapshotOf(video) }),
    ),
  );

  private onPause = pipe(
    O.Do,
    O.apS("video", O.fromNullable(this.video)),
    O.match(
      () => IO.of(undefined),
      ({ video }) => emit(this.listeners)({ _tag: "Engine/Paused", snapshot: snapshotOf(video) }),
    ),
  );

  private onWaiting = pipe(
    O.Do,
    O.apS("video", O.fromNullable(this.video)),
    O.match(
      () => IO.of(undefined),
      ({ video }) => emit(this.listeners)({ _tag: "Engine/Waiting", snapshot: snapshotOf(video) }),
    ),
  );

  private onEnded = pipe(
    O.Do,
    O.apS("video", O.fromNullable(this.video)),
    O.match(
      () => IO.of(undefined),
      ({ video }) => emit(this.listeners)({ _tag: "Engine/Ended", snapshot: snapshotOf(video) }),
    ),
  );

  private onSeeked = pipe(
    O.Do,
    O.apS("video", O.fromNullable(this.video)),
    O.match(
      () => IO.of(undefined),
      ({ video }) => emit(this.listeners)({ _tag: "Engine/Seeked", snapshot: snapshotOf(video) }),
    ),
  );

  private onVolumeChange = pipe(
    O.Do,
    O.apS("video", O.fromNullable(this.video)),
    O.match(
      () => IO.of(undefined),
      ({ video }) =>
        pipe(
          emit(this.listeners)({ _tag: "Engine/VolumeChanged", volume: video.volume }),
          IO.flatMap(() => emit(this.listeners)({ _tag: "Engine/MutedChanged", muted: video.muted })),
        ),
    ),
  );

  private onError = pipe(
    O.Do,
    O.apS("video", O.fromNullable(this.video)),
    O.match(
      () => IO.of(undefined),
      ({ video }) =>
        pipe(
          O.fromNullable(video.error),
          O.match(
            () =>
              emit(this.listeners)({
                _tag: "Engine/Error",
                kind: "unknown",
                message: "Unknown media error",
                url: this.url ?? undefined,
              }),
            (error) => {
              const formatMediaError = (err: MediaError) =>
                match(err.code)
                  .with(MediaError.MEDIA_ERR_ABORTED, () => ({
                    kind: "network" as const,
                    message: "Media loading aborted",
                  }))
                  .with(MediaError.MEDIA_ERR_NETWORK, () => ({
                    kind: "network" as const,
                    message: "Network error while loading media",
                  }))
                  .with(MediaError.MEDIA_ERR_DECODE, () => ({
                    kind: "decode" as const,
                    message: "Media decode error",
                  }))
                  .with(MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED, () => ({
                    kind: "not-supported" as const,
                    message: "Media format not supported",
                  }))
                  .otherwise(() => ({
                    kind: "media" as const,
                    message: `MediaError ${err.code}`,
                  }));

              const { kind, message } = formatMediaError(error);
              return emit(this.listeners)({
                _tag: "Engine/Error",
                kind,
                message: error.message || message,
                url: this.url ?? undefined,
                codec: kind === "decode" ? "unknown" : undefined,
                cause: error,
              });
            },
          ),
        ),
    ),
  );

  private onDashError = (event: any) =>
    pipe(
      O.Do,
      O.apS("error", O.fromNullable(event.error)),
      O.match(
        () => IO.of(undefined),
        ({ error }) => {
          const url = this.url ?? "unknown";
          const errorCode = error.code;
          const errorMessage = error.message || `DASH error: ${errorCode}`;

          return pipe(
            match(errorCode)
              .when(
                (code) => code >= 25 && code <= 27,
                () => {
                  const retryKey = `mpd:${url}`;
                  const currentRetry = this.retryCount.get(retryKey) || 0;

                  return pipe(
                    emit(this.listeners)({
                      _tag: "Engine/DASH/MPDParseError",
                      url,
                      retryCount: currentRetry,
                      message: errorMessage,
                      cause: error,
                    }),
                    IO.flatMap(() => () => {
                      this.retryCount.set(retryKey, currentRetry + 1);

                      pipe(
                        O.Do,
                        O.apS("player", O.fromNullable(this.player)),
                        O.apS("url", O.fromNullable(this.url)),
                        O.filter(() => currentRetry < 3 && errorCode === 27),
                        O.match(
                          () => IO.of(undefined),
                          ({ player, url }) =>
                            () => {
                              setTimeout(
                                () => {
                                  if (player && url) {
                                    player.attachSource(url);
                                  }
                                },
                                1000 * (currentRetry + 1),
                              );
                            },
                        ),
                      )();
                    }),
                  );
                },
              )
              .when(
                (code) => code >= 21 && code <= 24,
                () => {
                  const mediaType = error.data?.mediaType || "video";
                  const segmentIndex = error.data?.index || 0;
                  const retryKey = `segment:${mediaType}:${segmentIndex}`;
                  const currentRetry = this.retryCount.get(retryKey) || 0;

                  return pipe(
                    emit(this.listeners)({
                      _tag: "Engine/DASH/SegmentDownloadError",
                      segmentIndex,
                      mediaType: mediaType === "video" ? "video" : "audio",
                      retryCount: currentRetry,
                      message: errorMessage,
                      cause: error,
                    }),
                    IO.flatMap(() => () => {
                      this.retryCount.set(retryKey, currentRetry + 1);
                    }),
                  );
                },
              )
              .otherwise(() =>
                emit(this.listeners)({
                  _tag: "Engine/Error",
                  kind: "media",
                  message: errorMessage,
                  url: this.url ?? undefined,
                  cause: error,
                }),
              ),
          );
        },
      ),
    )();
}
