import { addEventListener } from "@hbb-emu/core";
import type { AdapterError } from "@hbb-emu/player-runtime";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOO from "fp-ts/IOOption";
import * as N from "fp-ts/number";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import type { NativeConfig } from ".";
import { BaseVideoAdapter } from "./base";
import { emit } from "./utils";

export class NativeAdapter extends BaseVideoAdapter<NativeConfig> {
  readonly type = "native" as const;
  readonly name = "Native HTML5";

  private canPlayThrough = false;

  constructor(protected readonly config: NativeConfig = {}) {
    super(config);
  }

  protected setupEngine(videoElement: HTMLVideoElement): IO.IO<void> {
    const updateProperty = <K extends keyof HTMLVideoElement>(
      property: K,
      value: O.Option<HTMLVideoElement[K]>,
    ): IO.IO<void> =>
      pipe(
        IOO.fromOption(value),
        IOO.matchE(
          () => IO.of(undefined),
          (v) => () => {
            videoElement[property] = v;
          },
        ),
      );

    return pipe(
      IO.Do,
      IO.flatMap(() => updateProperty("preload", O.fromNullable(this.config.preload))),
      IO.flatMap(() => updateProperty("crossOrigin", O.fromNullable(this.config.crossOrigin))),
      IO.flatMap(() => updateProperty("autoplay", O.fromNullable(this.config.autoplay))),
    );
  }

  protected override setupVideoEventListeners = (videoElement: HTMLVideoElement): IO.IO<void> => {
    // Native adapter needs additional events: progress and canplaythrough
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
      setupEventListeners,
      IO.flatMap((clean) => () => {
        this.cleanVideoElementEventListener = clean;
      }),
    );
  };

  protected cleanupEngine(): IO.IO<void> {
    return IO.of(undefined);
  }

  protected loadSource = (url: string): TE.TaskEither<AdapterError, void> =>
    pipe(
      TE.fromIOEither(this.getVideoElement),
      TE.flatMap((video) =>
        pipe(
          TE.tryCatch(
            () => {
              video.src = url;
              video.load();
              return Promise.resolve();
            },
            (error): AdapterError => ({
              _tag: "AdapterError/LoadFailed",
              message: error instanceof Error ? error.message : "Failed to load media",
              url,
              cause: error,
            }),
          ),
        ),
      ),
    );

  // Native-specific event handlers

  private onProgress = () => {
    const isValid = (video: HTMLVideoElement) =>
      video.buffered.length > 0 && Number.isFinite(video.duration) && video.duration > 0;

    const calculateBufferedTime = (ranges: TimeRanges) =>
      pipe(
        RA.makeBy(ranges.length, (index) => ranges.end(index) - ranges.start(index)),
        RA.reduce(0, N.MonoidSum.concat),
      );

    return pipe(
      IOO.Do,
      IOO.bind("video", () => IOO.fromNullable(this.video)),
      IOO.bind("url", () => IOO.fromNullable(this.url)),
      IOO.filter(({ video }) => isValid(video)),
      IOO.matchE(
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
    IOO.Do,
    IOO.bind("video", () => IOO.fromNullable(this.video)),
    IOO.matchE(
      () => IO.of(undefined),
      () => () => {
        this.canPlayThrough = true;
      },
    ),
  );
}
