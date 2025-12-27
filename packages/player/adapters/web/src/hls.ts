import type { AdapterError, HLSVariantInfo } from "@hbb-emu/player-runtime";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOO from "fp-ts/IOOption";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import Hls, { type ErrorData, ErrorTypes, type Events, type HlsListeners, type Level } from "hls.js";
import { match } from "ts-pattern";
import type { HLSConfig } from ".";
import { BaseVideoAdapter } from "./base";

export class HLSAdapter extends BaseVideoAdapter<HLSConfig> {
  readonly type = "hls" as const;

  private hls: Hls | null = null;
  private previousLevel: number | null = null;
  private retryCount = new Map<string, number>();

  private cleanHlsEventListener: IO.IO<void> = IO.of(undefined);

  constructor(protected readonly config: HLSConfig = {}) {
    super(config);
  }

  protected setupEngine(videoElement: HTMLVideoElement): IO.IO<void> {
    const init = () => {
      const hls = new Hls({
        autoStartLoad: true,
        ...this.config.hlsConfig,
        debug: this.config.debug,
        startLevel: this.config.startLevel,
      });

      hls.attachMedia(videoElement);
      this.hls = hls;
    };

    const setupEventListeners = (hls: Hls) =>
      pipe(
        RA.fromArray([
          () => {
            hls.on(Hls.Events.MANIFEST_LOADING, this.onManifestLoading);
            return () => hls.off(Hls.Events.MANIFEST_LOADING, this.onManifestLoading);
          },
          () => {
            hls.on(Hls.Events.MANIFEST_PARSED, this.onManifestParsed);
            return () => hls.off(Hls.Events.MANIFEST_PARSED, this.onManifestParsed);
          },
          () => {
            hls.on(Hls.Events.LEVEL_SWITCHED, this.onLevelSwitched);
            return () => hls.off(Hls.Events.LEVEL_SWITCHED, this.onLevelSwitched);
          },
          () => {
            hls.on(Hls.Events.LEVEL_SWITCHING, this.onLevelSwitching);
            return () => hls.off(Hls.Events.LEVEL_SWITCHING, this.onLevelSwitching);
          },
          () => {
            hls.on(Hls.Events.FRAG_LOADING, this.onFragLoading);
            return () => hls.off(Hls.Events.FRAG_LOADING, this.onFragLoading);
          },
          () => {
            hls.on(Hls.Events.ERROR, this.onHlsError);
            return () => hls.off(Hls.Events.ERROR, this.onHlsError);
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
        IO.flatMap((clean) => () => {
          this.cleanHlsEventListener = clean;
        }),
      );

    return pipe(
      Hls.isSupported(),
      O.fromPredicate((supported) => supported),
      O.match(
        () =>
          pipe(
            this.emit({
              _tag: "Engine/Error",
              kind: "media",
              message: "HLS.js is not supported in this browser",
            }),
            IO.asUnit,
          ),
        () =>
          pipe(
            IO.Do,
            IO.flatMap(() => init),
            IO.flatMap(() =>
              pipe(
                O.fromNullable(this.hls),
                O.match(() => IO.of(undefined), setupEventListeners),
              ),
            ),
          ),
      ),
    );
  }

  protected cleanupEngine(): IO.IO<void> {
    return pipe(
      IO.Do,
      IO.flatMap(() => this.cleanHlsEventListener),
      IO.flatMap(() => () => {
        if (this.hls) {
          this.hls.destroy();
          this.hls = null;
        }
      }),
    );
  }

  protected loadSource(url: string): TE.TaskEither<AdapterError, void> {
    return pipe(
      this.hls,
      TE.fromNullable({
        _tag: "AdapterError/VideoElementNotMounted" as const,
        message: "HLS player not initialized",
      }),
      TE.flatMap((hls) =>
        pipe(
          E.tryCatch(
            () => hls.loadSource(url),
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
  }

  // HLS-specific event handlers

  private onManifestLoading = pipe(
    IOO.Do,
    IOO.bind("url", () => IOO.fromNullable(this.url)),
    IOO.matchE(
      () => IO.of(undefined),
      ({ url }) =>
        this.emit({
          _tag: "Engine/HLS/ManifestLoading",
          url,
        }),
    ),
  );

  private onManifestParsed = pipe(
    IOO.Do,
    IOO.bind("video", () => IOO.fromNullable(this.video)),
    IOO.bind("url", () => IOO.fromNullable(this.url)),
    IOO.bind("hls", () => IOO.fromNullable(this.hls)),
    IOO.map(({ video, url, hls }) => {
      const variants = hls.levels.map(hlsLevelToVariant);
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      return { video, url, variants, duration };
    }),
    IOO.matchE(
      () => IO.of(undefined),
      ({ video, url, variants, duration }) =>
        pipe(
          this.emit({
            _tag: "Engine/HLS/ManifestParsed",
            url,
            variants,
            duration,
          }),
          IO.flatMap(() =>
            this.emit({
              _tag: "Engine/MetadataLoaded",
              playbackType: this.type,
              url,
              duration,
              width: video.videoWidth,
              height: video.videoHeight,
            }),
          ),
        ),
    ),
  );

  private onLevelSwitched: HlsListeners[Events.LEVEL_SWITCHED] = (_, data) =>
    pipe(
      IOO.Do,
      IOO.bind("hls", () => IOO.fromNullable(this.hls)),
      IOO.bind("level", ({ hls }) => IOO.fromNullable(hls.levels[data.level])),
      IOO.matchE(
        () => IO.of(undefined),
        ({ level }) =>
          pipe(
            this.emit({
              _tag: "Engine/HLS/VariantSelected",
              variant: hlsLevelToVariant(level),
              bandwidth: level.bitrate,
              resolution: { width: level.width || 0, height: level.height || 0 },
            }),
            IO.tap(() => () => {
              this.previousLevel = data.level;
            }),
            IO.asUnit,
          ),
      ),
    )();

  private onLevelSwitching: HlsListeners[Events.LEVEL_SWITCHING] = (_, data) =>
    pipe(
      IOO.Do,
      IOO.bind("hls", () => IOO.fromNullable(this.hls)),
      IOO.bind("previousLevel", () => IOO.fromNullable(this.previousLevel)),
      IOO.bind("fromLevel", ({ hls, previousLevel }) => IOO.fromNullable(hls.levels[previousLevel])),
      IOO.bind("toLevel", ({ hls }) => IOO.fromNullable(hls.levels[data.level])),
      IOO.matchE(
        () => IO.of(undefined),
        ({ fromLevel, toLevel }) =>
          this.emit({
            _tag: "Engine/HLS/AdaptiveSwitching",
            fromVariant: hlsLevelToVariant(fromLevel),
            toVariant: hlsLevelToVariant(toLevel),
            reason: "bandwidth",
          }),
      ),
    )();

  private onFragLoading: HlsListeners[Events.FRAG_LOADING] = (_, data) =>
    pipe(
      IOO.Do,
      IOO.bind("video", () => IOO.fromNullable(this.video)),
      IOO.bind("frag", () => IOO.fromNullable(data.frag)),
      IOO.bind("hls", () => IOO.fromNullable(this.hls)),
      IOO.matchE(
        () => IO.of(undefined),
        ({ video, frag, hls }) =>
          this.emit({
            _tag: "Engine/HLS/SegmentLoading",
            segmentIndex: typeof frag.sn === "number" ? frag.sn : 0,
            totalSegments: hls.levels[hls.currentLevel]?.details?.fragments.length || 0,
            currentTime: video.currentTime,
          }),
      ),
    )();

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
              this.emit({
                _tag: "Engine/HLS/ManifestParseError",
                url,
                retryCount: currentRetry,
                message: `HLS manifest error: ${data.details}`,
                cause: data,
              }),
              IO.tap(() => () => {
                this.retryCount.set(retryKey, currentRetry + 1);

                if (this.hls && currentRetry < 3) {
                  this.hls.loadSource(url);
                }
              }),
              IO.asUnit,
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
              this.emit({
                _tag: "Engine/HLS/SegmentLoadError",
                segmentIndex: fragSn,
                segmentUrl: fragUrl,
                retryCount: currentRetry,
                message: `HLS segment error: ${data.details}`,
                cause: data,
              }),
              IO.tap(() => () => {
                this.retryCount.set(retryKey, currentRetry + 1);

                if (this.hls && currentRetry < 3) {
                  this.hls.startLoad();
                }
              }),
              IO.asUnit,
            );
          },
        )
        .otherwise(() =>
          this.emit({
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

const hlsLevelToVariant = (level: Level): HLSVariantInfo => ({
  bandwidth: level.bitrate,
  resolution: { width: level.width || 0, height: level.height || 0 },
  codecs: level.videoCodec || level.audioCodec || "unknown",
  url: level.url[0] || "",
  frameRate: level.frameRate,
});
