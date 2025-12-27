import type { AdapterError } from "@hbb-emu/player-runtime";
import * as dashjs from "dashjs";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOO from "fp-ts/IOOption";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import type { DASHConfig } from ".";
import { BaseVideoAdapter } from "./base";

export class DASHAdapter extends BaseVideoAdapter<DASHConfig> {
  readonly type = "dash" as const;
  readonly name = "dash.js";

  private player: dashjs.MediaPlayerClass | null = null;
  private previousQuality: { video?: number; audio?: number } = {};
  private retryCount = new Map<string, number>();
  private fragmentDownloadProgress = new Map<string, { loaded: number; total: number }>();

  private cleanDashEventListener: IO.IO<void> = IO.of(undefined);

  constructor(protected readonly config: DASHConfig = {}) {
    super(config);
  }

  protected setupEngine(videoElement: HTMLVideoElement): IO.IO<void> {
    const init = () => {
      const player = dashjs.MediaPlayer().create();
      player.initialize(videoElement, undefined, false);
      this.player = player;
    };

    const setSettings =
      (settings: dashjs.MediaPlayerSettingClass): IO.IO<void> =>
      () =>
        this.player?.updateSettings(settings);

    const setLogLevel =
      (isDebug: boolean): IO.IO<void> =>
      () =>
        setSettings({ debug: { logLevel: isDebug ? dashjs.Debug.LOG_LEVEL_DEBUG : dashjs.Debug.LOG_LEVEL_NONE } });

    const setupEventListeners = (player: dashjs.MediaPlayerClass) =>
      pipe(
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
        IO.flatMap((clean) => () => {
          this.cleanDashEventListener = clean;
        }),
      );

    return pipe(
      IO.Do,
      IO.flatMap(() => init),
      IO.flatMap(() =>
        pipe(
          O.fromNullable(this.config.debug),
          O.match(() => IO.of(undefined), setLogLevel),
        ),
      ),
      IO.flatMap(() =>
        pipe(
          O.fromNullable(this.config.dashSettings),
          O.match(() => IO.of(undefined), setSettings),
        ),
      ),
      IO.flatMap(() =>
        pipe(
          O.fromNullable(this.player),
          O.match(() => IO.of(undefined), setupEventListeners),
        ),
      ),
    );
  }

  protected cleanupEngine(): IO.IO<void> {
    return pipe(
      IO.Do,
      IO.flatMap(() => this.cleanDashEventListener),
      IO.flatMap(() =>
        pipe(
          O.fromNullable(this.player),
          O.match(
            () => IO.of(undefined),
            (player) => () => {
              player.reset();
              this.player = null;
            },
          ),
        ),
      ),
    );
  }

  protected loadSource(url: string): TE.TaskEither<AdapterError, void> {
    return pipe(
      this.player,
      TE.fromNullable({
        _tag: "AdapterError/VideoElementNotMounted" as const,
        message: "Player not initialized",
      }),
      TE.flatMap((player) =>
        pipe(
          E.tryCatch(
            () => {
              this.url = url;
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
  }

  // DASH-specific event handlers

  private onManifestLoading = pipe(
    IOO.Do,
    IOO.bind("url", () => IOO.fromNullable(this.url)),
    IOO.matchE(
      () => IO.of(undefined),
      ({ url }) =>
        this.emit({
          _tag: "Engine/DASH/MPDLoading",
          url,
        }),
    ),
  );

  private onStreamInitialized = pipe(
    IOO.Do,
    IOO.bind("video", () => IOO.fromNullable(this.video)),
    IOO.bind("url", () => IOO.fromNullable(this.url)),
    IOO.bind("player", () => IOO.fromNullable(this.player)),
    IOO.map(({ video, url, player }) => {
      const videoTracks = player.getTracksFor("video") || [];
      const audioTracks = player.getTracksFor("audio") || [];
      const textTracks = player.getTracksFor("text") || [];

      const adaptationSets = [
        ...videoTracks.map((track: dashjs.MediaInfo) => ({
          id: track.id || "video",
          contentType: "video" as const,
          mimeType: track.mimeType || "unknown",
          representationCount: track.bitrateList?.length || 0,
        })),
        ...audioTracks.map((track: dashjs.MediaInfo) => ({
          id: track.id || "audio",
          contentType: "audio" as const,
          mimeType: track.mimeType || "unknown",
          representationCount: track.bitrateList?.length || 0,
        })),
        ...textTracks.map((track: dashjs.MediaInfo) => ({
          id: track.id || "text",
          contentType: "text" as const,
          mimeType: track.mimeType || "unknown",
          representationCount: 1,
        })),
      ];

      const isDynamic = player.isDynamic();
      const duration = Number.isFinite(video.duration) ? video.duration : 0;

      return { video, url, adaptationSets, isDynamic, duration };
    }),
    IOO.matchE(
      () => IO.of(undefined),
      ({ video, url, adaptationSets, isDynamic, duration }) =>
        pipe(
          this.emit({
            _tag: "Engine/DASH/MPDParsed",
            url,
            adaptationSets,
            duration,
            isDynamic,
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

  private onQualityChangeRequested = (event: dashjs.QualityChangeRequestedEvent) =>
    pipe(
      IOO.Do,
      IOO.bind("player", () => IOO.fromNullable(this.player)),
      IOO.filter(
        () =>
          event.mediaType === "video" &&
          event.oldRepresentation.qualityRanking !== undefined &&
          event.newRepresentation.qualityRanking !== undefined,
      ),
      IOO.matchE(
        () => IO.of(undefined),
        () =>
          this.emit({
            _tag: "Engine/DASH/QualitySwitching",
            fromRepresentation: {
              id: `${event.oldRepresentation.id}`,
              bandwidth: 0,
              codecs: "unknown",
            },
            toRepresentation: {
              id: `${event.newRepresentation.id}`,
              bandwidth: 0,
              codecs: "unknown",
            },
            reason: typeof event.reason === "string" ? event.reason : "abr",
          }),
      ),
    )();

  private onQualityChangeRendered = (event: dashjs.QualityChangeRenderedEvent) =>
    pipe(
      IOO.Do,
      IOO.bind("player", () => IOO.fromNullable(this.player)),
      IOO.bind("video", () => IOO.fromNullable(this.video)),
      IOO.filter(() => event.mediaType === "video" && event.newRepresentation.qualityRanking !== undefined),
      IOO.matchE(
        () => IO.of(undefined),
        ({ video }) =>
          pipe(
            this.emit({
              _tag: "Engine/DASH/RepresentationSelected",
              representation: {
                id: event.newRepresentation.id,
                bandwidth: 0,
                codecs: "unknown",
              },
              bandwidth: 0,
              resolution: { width: video.videoWidth || 0, height: video.videoHeight || 0 },
            }),
            IO.tap(() => () => {
              this.previousQuality.video = event.newRepresentation.qualityRanking;
            }),
            IO.asUnit,
          ),
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
      IOO.Do,
      IOO.bind("request", () => IOO.fromNullable(event.request)),
      IOO.matchE(
        () => IO.of(undefined),
        ({ request }) =>
          pipe(
            this.emit({
              _tag: "Engine/DASH/SegmentDownloading",
              segmentIndex: request.index || 0,
              mediaType: request.mediaType === "video" ? "video" : "audio",
              bytesLoaded: request.bytesTotal || 0,
              bytesTotal: request.bytesTotal || 0,
            }),
            IO.tap(() => () => {
              const key = `${request.mediaType}:${request.index}`;
              this.fragmentDownloadProgress.delete(key);
            }),
            IO.asUnit,
          ),
      ),
    )();

  private onDashError = (event: dashjs.MediaPlayerErrorEvent) => {
    const error = event.error;
    const errorCode = error.code;
    const errorMessage = error.message || `DASH error: ${errorCode}`;

    const handleManifestError = (): IO.IO<void> => {
      const url = this.url ?? "unknown";
      const retryKey = `mpd:${url}`;
      const currentRetry = this.retryCount.get(retryKey) || 0;

      return pipe(
        this.emit({
          _tag: "Engine/DASH/MPDParseError",
          url,
          retryCount: currentRetry,
          message: errorMessage,
          cause: event,
        }),
        IO.tap(() => () => {
          this.retryCount.set(retryKey, currentRetry + 1);
        }),
        IO.flatMap(() =>
          pipe(
            O.Do,
            O.apS("player", O.fromNullable(this.player)),
            O.apS("url", O.fromNullable(this.url)),
            O.filter(() => currentRetry < 3),
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
          ),
        ),
      );
    };

    const handleDownloadError = (): IO.IO<void> =>
      this.emit({
        _tag: "Engine/Error",
        kind: "media",
        message: errorMessage,
        url: this.url ?? undefined,
        cause: event,
      });

    const handleGenericError = (): IO.IO<void> =>
      this.emit({
        _tag: "Engine/Error",
        kind: "media",
        message: errorMessage,
        url: this.url ?? undefined,
        cause: event,
      });

    const {
      MANIFEST_LOADER_PARSING_FAILURE_ERROR_CODE,
      DOWNLOAD_ERROR_ID_MANIFEST_CODE,
      MANIFEST_ERROR_ID_PARSE_CODE,
      MANIFEST_ERROR_ID_NOSTREAMS_CODE,
      FRAGMENT_LOADER_LOADING_FAILURE_ERROR_CODE,
      DOWNLOAD_ERROR_ID_CONTENT_CODE,
      DOWNLOAD_ERROR_ID_INITIALIZATION_CODE,
    } = new dashjs.Errors();

    return match(errorCode)
      .when(
        (code) =>
          code === MANIFEST_LOADER_PARSING_FAILURE_ERROR_CODE ||
          code === DOWNLOAD_ERROR_ID_MANIFEST_CODE ||
          code === MANIFEST_ERROR_ID_PARSE_CODE ||
          code === MANIFEST_ERROR_ID_NOSTREAMS_CODE,
        handleManifestError,
      )
      .when(
        (code) =>
          code === FRAGMENT_LOADER_LOADING_FAILURE_ERROR_CODE ||
          code === DOWNLOAD_ERROR_ID_CONTENT_CODE ||
          code === DOWNLOAD_ERROR_ID_INITIALIZATION_CODE,
        handleDownloadError,
      )
      .otherwise(handleGenericError)();
  };
}
