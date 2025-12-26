import { addEventListener } from "@hbb-emu/core";
import type { AdapterError, RuntimeAdapter, UnsubscribeFn } from "@hbb-emu/player-runtime";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as N from "fp-ts/number";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import type { NativeConfig } from ".";
import { emit, snapshotOf, type VideoEventListener } from "./utils";

export class NativeAdapter implements RuntimeAdapter {
  readonly type = "native" as const;
  readonly name = "Native HTML5";

  private video: HTMLVideoElement | null = null;
  private url: string | null = null;
  private readonly listeners = new Set<VideoEventListener>();

  private cleanVideoElementEventListener: IO.IO<void> = IO.of(undefined);

  constructor(private readonly config: NativeConfig = {}) {}

  mount =
    (videoElement: HTMLVideoElement): IO.IO<void> =>
    () => {
      this.video = videoElement;

      const updateProperty = <K extends keyof HTMLVideoElement>(
        property: K,
        value: O.Option<HTMLVideoElement[K]>,
      ): IO.IO<void> =>
        pipe(
          value,
          O.match(
            () => IO.of(undefined),
            (v) => () => {
              videoElement[property] = v;
            },
          ),
        );

      const updateNativeConfig = pipe(
        IO.Do,
        IO.flatMap(() => updateProperty("preload", O.fromNullable(this.config.preload))),
        IO.flatMap(() => updateProperty("crossOrigin", O.fromNullable(this.config.crossOrigin))),
        IO.flatMap(() => updateProperty("autoplay", O.fromNullable(this.config.autoplay))),
      );

      const setupEventListeners = pipe(
        RA.fromArray([
          addEventListener(videoElement)("loadedmetadata")(this.onLoadedMetadata),
          addEventListener(videoElement)("progress")(this.onProgress),
          addEventListener(videoElement)("canplaythrough")(this.onCanPlayThrough),
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
        IO.flatMap(() => updateNativeConfig),
        IO.flatMap(
          () =>
            pipe(
              setupEventListeners,
              IO.flatMap((clean) => () => {
                this.cleanVideoElementEventListener = clean;
              }),
            ),
          IO.flatMap(() => emit(this.listeners)({ _tag: "Engine/Mounted" })),
        ),
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

  subscribe = (listener: VideoEventListener): IO.IO<UnsubscribeFn> =>
    pipe(
      IO.of(this.listeners.add(listener)),
      IO.map(() => IO.of(this.listeners.delete(listener))),
    );

  // TODO: Resolved when metadata is loaded
  load = (url: string): TE.TaskEither<AdapterError, void> =>
    pipe(
      this.getVideoElement,
      TE.tapIO(() => () => {
        this.url = url;
      }),
      TE.flatMap((video) =>
        pipe(
          E.tryCatch(
            () => {
              video.src = url;
              video.load();
            },
            (error): AdapterError => ({
              _tag: "AdapterError/LoadFailed",
              message: error instanceof Error ? error.message : "Failed to load media",
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

  // TODO: Resolved when paused event is fired
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

  // TODO: Resolved when seeked event is fired
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
    this.getVideoElement,
    TE.flatMap(() => TE.fromIO(this.cleanVideoElementEventListener)),
    TE.tapIO(() => () => {
      this.video = null;
      this.url = null;
    }),
  );

  // Event Handlers

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

  private canPlayThrough = false; // FIXME

  private onProgress = () => {
    const isValid = (video: HTMLVideoElement) =>
      video.buffered.length > 0 && Number.isFinite(video.duration) && video.duration > 0;

    const calculateBufferedTime = (ranges: TimeRanges) =>
      pipe(
        RA.makeBy(ranges.length, (index) => ranges.end(index) - ranges.start(index)),
        RA.reduce(0, N.MonoidSum.concat),
      );

    return pipe(
      O.Do,
      O.apS("video", O.fromNullable(this.video)),
      O.apS("url", O.fromNullable(this.url)),
      O.filter(({ video }) => isValid(video)),
      O.match(
        () => IO.of(undefined),
        ({ video, url }) =>
          emit(this.listeners)({
            _tag: "Engine/Native/ProgressiveLoading",
            url,
            bytesLoaded: calculateBufferedTime(video.buffered),
            bytesTotal: video.duration,
            canPlayThrough: this.canPlayThrough,
          }),
      ),
    )();
  };

  private onCanPlayThrough = pipe(
    O.Do,
    O.apS("video", O.fromNullable(this.video)),
    O.match(
      () => IO.of(undefined),
      () => () => {
        this.canPlayThrough = true;
      },
    ),
  );

  private onError = () => {
    const formatMediaError = (error: MediaError) =>
      match(error.code)
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
          message: `MediaError ${error.code}`,
        }));

    return pipe(
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
    )();
  };
}
