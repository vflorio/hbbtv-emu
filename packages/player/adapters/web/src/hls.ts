import { addEventListener } from "@hbb-emu/core";
import type { AdapterError, RuntimeAdapter, UnsubscribeFn } from "@hbb-emu/player-runtime";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import Hls, { type ErrorData, ErrorTypes } from "hls.js";
import { match } from "ts-pattern";
import type { HLSConfig } from ".";
import { emit, snapshotOf, type VideoEventListener } from "./utils";

export class HLSAdapter implements RuntimeAdapter {
  readonly type = "hls" as const;
  readonly name = "HLS.js";

  private video: HTMLVideoElement | null = null;
  private hls: Hls | null = null;
  private url: string | null = null;
  private readonly listeners = new Set<VideoEventListener>();
  private previousLevel: number | null = null;
  private retryCount = new Map<string, number>();

  private cleanVideoElementEventListener: IO.IO<void> = IO.of(undefined);
  private cleanHlsEventListener: IO.IO<void> = IO.of(undefined);

  constructor(private readonly config: HLSConfig = {}) {}

  mount =
    (videoElement: HTMLVideoElement): IO.IO<void> =>
    () => {
      this.video = videoElement;

      const supported = Hls.isSupported();
      if (!supported) {
        emit(this.listeners)({
          _tag: "Engine/Error",
          kind: "media",
          message: "HLS.js is not supported in this browser",
        })();
        return;
      }

      const hls = new Hls({
        autoStartLoad: true,
        ...this.config.hlsConfig,
        debug: this.config.debug,
        startLevel: this.config.startLevel,
      });

      hls.attachMedia(videoElement);

      const setupHlsEventListeners = pipe(
        RA.fromArray([
          () => {
            hls.on(Hls.Events.MANIFEST_LOADING, this.onManifestLoading);
            return IO.of(() => hls.off(Hls.Events.MANIFEST_LOADING, this.onManifestLoading));
          },
          () => {
            hls.on(Hls.Events.MANIFEST_PARSED, this.onManifestParsed);
            return IO.of(() => hls.off(Hls.Events.MANIFEST_PARSED, this.onManifestParsed));
          },
          () => {
            hls.on(Hls.Events.LEVEL_SWITCHED, this.onLevelSwitched);
            return IO.of(() => hls.off(Hls.Events.LEVEL_SWITCHED, this.onLevelSwitched));
          },
          () => {
            hls.on(Hls.Events.LEVEL_SWITCHING, this.onLevelSwitching);
            return IO.of(() => hls.off(Hls.Events.LEVEL_SWITCHING, this.onLevelSwitching));
          },
          () => {
            hls.on(Hls.Events.FRAG_LOADING, this.onFragLoading);
            return IO.of(() => hls.off(Hls.Events.FRAG_LOADING, this.onFragLoading));
          },
          () => {
            hls.on(Hls.Events.ERROR, this.onHlsError);
            return IO.of(() => hls.off(Hls.Events.ERROR, this.onHlsError));
          },
        ]),
        RA.traverse(IO.Applicative)((addListener) => addListener()),
        IO.map((removeEventListeners) =>
          pipe(
            removeEventListeners,
            RA.traverse(IO.Applicative)((remove) => remove),
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
        IO.flatMap(() =>
          pipe(
            setupHlsEventListeners,
            IO.flatMap((clean) => () => {
              this.cleanHlsEventListener = clean;
            }),
          ),
        ),
        IO.flatMap(() =>
          pipe(
            setupEventListeners,
            IO.flatMap((clean) => () => {
              this.cleanVideoElementEventListener = clean;
              this.hls = hls;
            }),
          ),
        ),
        IO.flatMap(() => emit(this.listeners)({ _tag: "Engine/Mounted" })),
      );
    };

  subscribe = (listener: VideoEventListener): IO.IO<UnsubscribeFn> =>
    pipe(
      IO.of(this.listeners.add(listener)),
      IO.map(() => IO.of(this.listeners.delete(listener))),
    );

  private getVideoElement: TE.TaskEither<AdapterError, HTMLVideoElement> = TE.fromEither(
    pipe(
      this.video,
      E.fromNullable({
        _tag: "AdapterError/VideoElementNotMounted" as const,
        message: "Video element not mounted",
      }),
    ),
  );

  private getHlsInstance: TE.TaskEither<AdapterError, Hls> = TE.fromEither(
    pipe(
      this.hls,
      E.fromNullable({
        _tag: "AdapterError/VideoElementNotMounted" as const,
        message: "HLS player not initialized",
      }),
    ),
  );

  load = (url: string): TE.TaskEither<AdapterError, void> =>
    pipe(
      this.getHlsInstance,
      TE.tapIO(() => () => {
        this.url = url;
      }),
      TE.flatMap((hls) =>
        pipe(
          E.tryCatch(
            () => {
              hls.loadSource(url);
            },
            (error): AdapterError => ({
              _tag: "AdapterError/LoadFailed",
              message: error instanceof Error ? error.message : "Failed to load HLS source",
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
    TE.fromIO(this.cleanHlsEventListener),
    TE.flatMap(() => TE.fromIO(this.cleanVideoElementEventListener)),
    TE.flatMap(() =>
      TE.fromEither(
        E.tryCatch(
          () => {
            if (this.hls) {
              this.hls.destroy();
            }
            if (this.video) {
              this.video.pause();
            }
          },
          (error): AdapterError => ({
            _tag: "AdapterError/DestroyFailed",
            message: error instanceof Error ? error.message : "Failed to destroy HLS adapter",
            cause: error,
          }),
        ),
      ),
    ),
    TE.tapIO(() => () => {
      this.video = null;
      this.hls = null;
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
          _tag: "Engine/HLS/ManifestLoading",
          url,
        }),
    ),
  );

  private onManifestParsed = pipe(
    O.Do,
    O.apS("video", O.fromNullable(this.video)),
    O.apS("url", O.fromNullable(this.url)),
    O.apS("hls", O.fromNullable(this.hls)),
    O.match(
      () => IO.of(undefined),
      ({ video, url, hls }) =>
        () => {
          const variants = hls.levels.map((level) => ({
            bandwidth: level.bitrate,
            resolution: { width: level.width || 0, height: level.height || 0 },
            codecs: level.videoCodec || level.audioCodec || "unknown",
            url: level.url[0] || "",
            frameRate: level.frameRate,
          }));

          const duration = Number.isFinite(video.duration) ? video.duration : 0;

          pipe(
            emit(this.listeners)({
              _tag: "Engine/HLS/ManifestParsed",
              url,
              variants,
              duration,
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

  private onLevelSwitched = (_event: string, data: any) =>
    pipe(
      O.Do,
      O.apS("hls", O.fromNullable(this.hls)),
      O.bind("level", ({ hls }) => O.fromNullable(hls.levels[data.level])),
      O.match(
        () => IO.of(undefined),
        ({ level }) =>
          () => {
            const variant = {
              bandwidth: level.bitrate,
              resolution: { width: level.width || 0, height: level.height || 0 },
              codecs: level.videoCodec || level.audioCodec || "unknown",
              url: level.url[0] || "",
              frameRate: level.frameRate,
            };

            emit(this.listeners)({
              _tag: "Engine/HLS/VariantSelected",
              variant,
              bandwidth: level.bitrate,
              resolution: { width: level.width || 0, height: level.height || 0 },
            })();

            this.previousLevel = data.level;
          },
      ),
    )();

  private onLevelSwitching = (_event: string, data: any) =>
    pipe(
      O.Do,
      O.apS("hls", O.fromNullable(this.hls)),
      O.apS("previousLevel", O.fromNullable(this.previousLevel)),
      O.bind("fromLevel", ({ hls, previousLevel }) => O.fromNullable(hls.levels[previousLevel])),
      O.bind("toLevel", ({ hls }) => O.fromNullable(hls.levels[data.level])),
      O.match(
        () => IO.of(undefined),
        ({ fromLevel, toLevel }) =>
          () => {
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

            emit(this.listeners)({
              _tag: "Engine/HLS/AdaptiveSwitching",
              fromVariant,
              toVariant,
              reason: "bandwidth",
            })();
          },
      ),
    )();

  private onFragLoading = (_event: string, data: any) =>
    pipe(
      O.Do,
      O.apS("video", O.fromNullable(this.video)),
      O.apS("frag", O.fromNullable(data.frag)),
      O.apS("hls", O.fromNullable(this.hls)),
      O.match(
        () => IO.of(undefined),
        ({ video, frag, hls }) =>
          emit(this.listeners)({
            _tag: "Engine/HLS/SegmentLoading",
            segmentIndex: frag.sn,
            totalSegments: hls.levels[hls.currentLevel]?.details?.fragments.length || 0,
            currentTime: video.currentTime,
          }),
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

  private onHlsError = (_event: string, data: ErrorData) => {
    if (!data.fatal) return;

    const url = this.url ?? "unknown";

    pipe(
      match({ type: data.type, details: data.details })
        .when(
          ({ type, details }) =>
            type === ErrorTypes.NETWORK_ERROR && (details.includes("manifest") || details.includes("Manifest")),
          () => {
            const retryKey = `manifest:${url}`;
            const currentRetry = this.retryCount.get(retryKey) || 0;

            return pipe(
              emit(this.listeners)({
                _tag: "Engine/HLS/ManifestParseError",
                url,
                retryCount: currentRetry,
                message: `HLS manifest error: ${data.details}`,
                cause: data,
              }),
              IO.flatMap(() => () => {
                this.retryCount.set(retryKey, currentRetry + 1);

                if (this.hls && currentRetry < 3) {
                  this.hls.loadSource(url);
                }
              }),
            );
          },
        )
        .when(
          ({ type, details }) => type === ErrorTypes.NETWORK_ERROR && details.includes("frag"),
          () => {
            const fragSn = typeof data.frag?.sn === "number" ? data.frag.sn : 0;
            const fragUrl = data.frag?.url || "unknown";
            const retryKey = `frag:${fragUrl}`;
            const currentRetry = this.retryCount.get(retryKey) || 0;

            return pipe(
              emit(this.listeners)({
                _tag: "Engine/HLS/SegmentLoadError",
                segmentIndex: fragSn,
                segmentUrl: fragUrl,
                retryCount: currentRetry,
                message: `HLS segment error: ${data.details}`,
                cause: data,
              }),
              IO.flatMap(() => () => {
                this.retryCount.set(retryKey, currentRetry + 1);

                if (this.hls && currentRetry < 3) {
                  this.hls.startLoad();
                }
              }),
            );
          },
        )
        .otherwise(() =>
          emit(this.listeners)({
            _tag: "Engine/Error",
            kind: "media",
            message: `HLS ${data.type} error: ${data.details}`,
            url: this.url ?? undefined,
            cause: data,
          }),
        ),
    )();
  };
}
