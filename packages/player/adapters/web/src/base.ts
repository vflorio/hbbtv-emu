import { addEventListener } from "@hbb-emu/core";
import type { AdapterError, PlaybackType, RuntimeAdapter, UnsubscribeFn } from "@hbb-emu/player-runtime";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as IOE from "fp-ts/IOEither";
import * as IOO from "fp-ts/IOOption";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import { emit, snapshotOf, type VideoEventListener } from "./utils";

/**
 * Base class for video player adapters.
 * Provides common functionality for HTMLVideoElement manipulation and event handling.
 *
 * Subclasses must implement:
 * - setupEngine: Initialize the specific player engine (HLS.js, dash.js, etc.)
 * - loadSource: Load media source using the specific engine
 * - cleanupEngine: Clean up engine-specific resources
 */
export abstract class BaseVideoAdapter<TConfig = unknown> implements RuntimeAdapter {
  abstract readonly type: PlaybackType;
  abstract readonly name: string;

  protected video: HTMLVideoElement | null = null;
  protected url: string | null = null;
  protected readonly listeners = new Set<VideoEventListener>();
  protected cleanVideoElementEventListener: IO.IO<void> = IO.of(undefined);

  constructor(protected readonly config: TConfig) {}

  /**
   * Mount the adapter to a video element.
   * Template method that orchestrates engine setup and event listener registration.
   */
  mount =
    (videoElement: HTMLVideoElement): IO.IO<void> =>
    () => {
      this.video = videoElement;

      return pipe(
        IO.Do,
        IO.flatMap(() => this.setupEngine(videoElement)),
        IO.flatMap(() => this.setupVideoEventListeners(videoElement)),
        IO.flatMap(() => this.syncInitialState(videoElement)),
        IO.flatMap(() => emit(this.listeners)({ _tag: "Engine/Mounted" })),
      )();
    };

  /**
   * Setup the specific player engine (HLS.js, dash.js, native, etc.).
   * Called during mount before video event listeners are attached.
   */
  protected abstract setupEngine(videoElement: HTMLVideoElement): IO.IO<void>;

  /**
   * Load media source using the specific engine.
   * Called by the common load method after setting the URL.
   */
  protected abstract loadSource(url: string): TE.TaskEither<AdapterError, void>;

  /**
   * Clean up engine-specific resources.
   * Called during destroy before common cleanup.
   */
  protected abstract cleanupEngine(): IO.IO<void>;

  /**
   * Setup standard HTMLVideoElement event listeners.
   * Common across all adapters.
   */
  protected setupVideoEventListeners(videoElement: HTMLVideoElement): IO.IO<void> {
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
      setupEventListeners,
      IO.flatMap((clean) => () => {
        this.cleanVideoElementEventListener = clean;
      }),
    );
  }

  /**
   * Synchronize adapter state with the current video element state.
   */
  protected syncInitialState(videoElement: HTMLVideoElement): IO.IO<void> {
    const emitMetadataIfLoaded = pipe(
      IOO.Do,
      IOO.bind("url", () => IOO.fromNullable(this.url)),
      IOO.filter(() => videoElement.readyState >= HTMLMediaElement.HAVE_METADATA),
      IOO.matchE(
        () => IO.of(undefined),
        ({ url }) =>
          emit(this.listeners)({
            _tag: "Engine/MetadataLoaded",
            playbackType: this.type,
            url,
            duration: Number.isFinite(videoElement.duration) ? videoElement.duration : 0,
            width: videoElement.videoWidth,
            height: videoElement.videoHeight,
          }),
      ),
    );

    const emitPlaybackState = pipe(
      O.some(videoElement),
      O.filter((v) => v.ended),
      O.match(
        () =>
          pipe(
            O.some(videoElement),
            O.filter(
              (video) => !video.paused && !video.ended && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
            ),
            O.match(
              () => IO.of(undefined),
              (v) =>
                emit(this.listeners)({
                  _tag: "Engine/Playing",
                  snapshot: snapshotOf(v),
                }),
            ),
          ),
        (v) =>
          emit(this.listeners)({
            _tag: "Engine/Ended",
            snapshot: snapshotOf(v),
          }),
      ),
    );

    const emitVolumeState = pipe(
      IO.Do,
      IO.flatMap(() => emit(this.listeners)({ _tag: "Engine/VolumeChanged", volume: videoElement.volume })),
      IO.flatMap(() => emit(this.listeners)({ _tag: "Engine/MutedChanged", muted: videoElement.muted })),
    );

    return pipe(
      IO.Do,
      IO.flatMap(() => emitMetadataIfLoaded),
      IO.flatMap(() => emitPlaybackState),
      IO.flatMap(() => emitVolumeState),
    );
  }

  protected getVideoElement: IOE.IOEither<AdapterError, HTMLVideoElement> = () =>
    pipe(
      this.video,
      E.fromNullable({
        _tag: "AdapterError/VideoElementNotMounted" as const,
        message: "Video element not mounted",
      }),
    );

  subscribe = (listener: VideoEventListener): IO.IO<UnsubscribeFn> =>
    pipe(
      IO.of(this.listeners.add(listener)),
      IO.map(() => IO.of(this.listeners.delete(listener))),
    );

  load = (url: string): TE.TaskEither<AdapterError, void> =>
    pipe(
      TE.fromIO(() => {
        this.url = url;
      }),
      TE.flatMap(() => this.loadSource(url)),
    );

  play: TE.TaskEither<AdapterError, void> = pipe(
    TE.fromIOEither(this.getVideoElement),
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
    TE.fromIOEither(this.getVideoElement),
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
      TE.fromIOEither(this.getVideoElement),
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
      TE.fromIOEither(this.getVideoElement),
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
      TE.fromIOEither(this.getVideoElement),
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
    TE.fromIO(this.cleanupEngine()),
    TE.flatMap(() => TE.fromIO(this.cleanVideoElementEventListener)),
    TE.tapIO(() => () => {
      this.video = null;
      this.url = null;
    }),
  );

  // Standard HTML5 video event handlers

  protected onLoadedMetadata = pipe(
    IOO.Do,
    IOO.bind("video", () => IOO.fromNullable(this.video)),
    IOO.bind("url", () => IOO.fromNullable(this.url)),
    IOO.matchE(
      () => () => console.log("onLoadedMetadata: video or url is null"),
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

  protected onTimeUpdate = pipe(
    IOO.Do,
    IOO.bind("video", () => IOO.fromNullable(this.video)),
    IOO.matchE(
      () => IO.of(undefined),
      ({ video }) => emit(this.listeners)({ _tag: "Engine/TimeUpdated", snapshot: snapshotOf(video) }),
    ),
  );

  protected onPlaying = pipe(
    IOO.Do,
    IOO.bind("video", () => IOO.fromNullable(this.video)),
    IOO.matchE(
      () => IO.of(undefined),
      ({ video }) => emit(this.listeners)({ _tag: "Engine/Playing", snapshot: snapshotOf(video) }),
    ),
  );

  protected onPause = pipe(
    IOO.Do,
    IOO.bind("video", () => IOO.fromNullable(this.video)),
    IOO.matchE(
      () => IO.of(undefined),
      ({ video }) => emit(this.listeners)({ _tag: "Engine/Paused", snapshot: snapshotOf(video) }),
    ),
  );

  protected onWaiting = pipe(
    IOO.Do,
    IOO.bind("video", () => IOO.fromNullable(this.video)),
    IOO.matchE(
      () => IO.of(undefined),
      ({ video }) => emit(this.listeners)({ _tag: "Engine/Waiting", snapshot: snapshotOf(video) }),
    ),
  );

  protected onEnded = pipe(
    IOO.Do,
    IOO.bind("video", () => IOO.fromNullable(this.video)),
    IOO.matchE(
      () => IO.of(undefined),
      ({ video }) => emit(this.listeners)({ _tag: "Engine/Ended", snapshot: snapshotOf(video) }),
    ),
  );

  protected onSeeked = pipe(
    IOO.Do,
    IOO.bind("video", () => IOO.fromNullable(this.video)),
    IOO.matchE(
      () => IO.of(undefined),
      ({ video }) => emit(this.listeners)({ _tag: "Engine/Seeked", snapshot: snapshotOf(video) }),
    ),
  );

  protected onVolumeChange = pipe(
    IOO.Do,
    IOO.bind("video", () => IOO.fromNullable(this.video)),
    IOO.matchE(
      () => IO.of(undefined),
      ({ video }) =>
        pipe(
          emit(this.listeners)({ _tag: "Engine/VolumeChanged", volume: video.volume }),
          IO.flatMap(() => emit(this.listeners)({ _tag: "Engine/MutedChanged", muted: video.muted })),
        ),
    ),
  );

  protected onError = pipe(
    IOO.Do,
    IOO.bind("video", () => IOO.fromNullable(this.video)),
    IOO.matchE(
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
}
