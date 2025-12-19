import { createLogger } from "@hbb-emu/core";
import { addEventListener } from "@hbb-emu/core/dom";
import * as dashjs from "dashjs";
import { sequenceT } from "fp-ts/Apply";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RIO from "fp-ts/ReaderIO";
import { match } from "ts-pattern";
import type { Player, PlayerEventListener, PlayerEventType, PlayerSource } from ".";
import { PlayerPlayState } from ".";
import * as PlayerCommon from "./common";

const logger = createLogger("DashPlayer");

type DashPlayerEnv = PlayerCommon.PlayerEnv & {
  dashPlayer: dashjs.MediaPlayerClass | null;
  setDashPlayer: (player: dashjs.MediaPlayerClass | null) => IO.IO<void>;
};

export class DashPlayer implements Player {
  readonly sourceType = "dash" as const;
  readonly videoElement: HTMLVideoElement;

  readonly #env: DashPlayerEnv;
  #state: PlayerPlayState = PlayerPlayState.IDLE;
  #source: PlayerSource | null = null;
  #currentSpeed = 1;
  #dashPlayer: dashjs.MediaPlayerClass | null = null;

  constructor(videoElement?: HTMLVideoElement) {
    this.videoElement = videoElement ?? document.createElement("video");

    this.#env = {
      state: this.#state,
      source: this.#source,
      currentSpeed: this.#currentSpeed,
      listeners: PlayerCommon.createEventListeners(),
      videoElement: this.videoElement,
      dashPlayer: this.#dashPlayer,
      setState: (newState) => () => {
        this.#state = newState;
        this.#env.state = newState;
      },
      setSource: (source) => () => {
        this.#source = source;
        this.#env.source = source;
      },
      setCurrentSpeed: (speed) => () => {
        this.#currentSpeed = speed;
        this.#env.currentSpeed = speed;
      },
      setDashPlayer: (player) => () => {
        this.#dashPlayer = player;
        this.#env.dashPlayer = player;
      },
    };

    // If videoElement was provided (reused from another player), reset it
    if (videoElement) {
      // Clear any existing src to ensure clean state
      videoElement.removeAttribute("src");
      videoElement.load();
    }
  }

  load = (source: PlayerSource): IO.IO<void> => load(source)(this.#env);
  release = (): IO.IO<void> => release(this.#env);
  setupListeners = (): IO.IO<void> => setupVideoEventListeners(this.#env);

  play = (speed = 1): IO.IO<void> => play(speed)(this.#env);
  pause = (): IO.IO<void> => PlayerCommon.pause()(this.#env);
  stop = (): IO.IO<void> => PlayerCommon.stop()(this.#env);
  seek = (position: number): IO.IO<void> => seek(position)(this.#env);

  setVolume = (volume: number): IO.IO<void> => PlayerCommon.setVolume(volume)(this.#env);
  setMuted = (muted: boolean): IO.IO<void> => PlayerCommon.setMuted(muted)(this.#env);
  setFullscreen = (fullscreen: boolean): IO.IO<void> => PlayerCommon.setFullscreen(fullscreen)(this.#env);
  setSize = (width: number, height: number): IO.IO<void> => PlayerCommon.setSize(width, height)(this.#env);

  on = <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void> =>
    PlayerCommon.on(type, listener)(this.#env);

  off = <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void> =>
    PlayerCommon.off(type, listener)(this.#env);
}

// Methods

const setupVideoEventListeners: RIO.ReaderIO<DashPlayerEnv, void> = (env) =>
  sequenceT(IO.Applicative)(
    addEventListener(env.videoElement)("error")(() => {
      logger.error("Video error:", env.videoElement.error)();
      pipe(
        PlayerCommon.setState(PlayerPlayState.ERROR),
        RIO.flatMap(() => PlayerCommon.emit("error", { error: PlayerCommon.createVideoError(env.videoElement) })),
      )(env)();
    }),
    addEventListener(env.videoElement)("ended")(() => {
      pipe(
        PlayerCommon.setState(PlayerPlayState.FINISHED),
        RIO.tapIO(() => logger.debug(`ended event received`)),
        RIO.flatMap(() => PlayerCommon.emit("ended", {})),
      )(env)();
    }),
    addEventListener(env.videoElement)("timeupdate")(() => {
      const currentTime = PlayerCommon.getCurrentTimeMs(env.videoElement);
      PlayerCommon.emit("timeupdate", { currentTime })(env)();
    }),
    addEventListener(env.videoElement)("durationchange")(() => {
      if (Number.isFinite(env.videoElement.duration)) {
        PlayerCommon.emit("durationchange", { duration: PlayerCommon.getDurationMs(env.videoElement) })(env)();
      }
    }),
    addEventListener(env.videoElement)("volumechange")(() =>
      PlayerCommon.emit("volumechange", {
        volume: PlayerCommon.normalizedToVolume(env.videoElement.volume),
        muted: env.videoElement.muted,
      })(env)(),
    ),
    addEventListener(document)("fullscreenchange")(() =>
      PlayerCommon.emit("fullscreenchange", { fullscreen: PlayerCommon.isFullscreen(env.videoElement) })(env)(),
    ),
  );

const initDashPlayer: RIO.ReaderIO<DashPlayerEnv, dashjs.MediaPlayerClass> = pipe(
  RIO.ask<DashPlayerEnv>(),
  RIO.flatMap((env) =>
    match(env.dashPlayer)
      .with(null, () =>
        pipe(
          RIO.of<DashPlayerEnv, dashjs.MediaPlayerClass>(dashjs.MediaPlayer().create()),
          RIO.tapIO((player) => () => {
            player.initialize(env.videoElement, undefined, false);
            // Disable auto-restart on completion
            player.updateSettings({
              streaming: {
                buffer: {
                  fastSwitchEnabled: true,
                },
                abr: {
                  autoSwitchBitrate: {
                    video: true,
                  },
                },
              },
            });
            // Prevent auto-play on completion
            env.videoElement.loop = false;
          }),
          RIO.tap((player) => setupDashEventHandlers(player)),
          RIO.tapIO((player) => env.setDashPlayer(player)),
        ),
      )
      .otherwise((player) =>
        pipe(
          RIO.of(player),
          RIO.tapIO(() => () => {
            // Re-initialize dash.js if videoElement was reused from another player
            // reset() clears all event listeners and source
            player.reset();
            player.initialize(env.videoElement, undefined, false);
          }),
          RIO.tap((player) => setupDashEventHandlers(player)),
        ),
      ),
  ),
);

const setupDashEventHandlers = (dashPlayer: dashjs.MediaPlayerClass): RIO.ReaderIO<DashPlayerEnv, void> =>
  pipe(
    RIO.ask<DashPlayerEnv>(),
    RIO.flatMapIO((env) => () => {
      dashPlayer.on("error", (event: unknown) => {
        logger.error("DASH error:", event)();
        pipe(
          PlayerCommon.setState(PlayerPlayState.ERROR),
          RIO.flatMap(() => PlayerCommon.emit("error", { error: PlayerCommon.createDashError(event) })),
        )(env)();
      });

      dashPlayer.on("playbackStarted", () => {
        PlayerCommon.setState(PlayerPlayState.PLAYING)(env)();
      });

      dashPlayer.on("playbackPaused", () => {
        match(env.state)
          .with(PlayerPlayState.PLAYING, () => PlayerCommon.setState(PlayerPlayState.PAUSED)(env)())
          .otherwise(() => {});
      });

      dashPlayer.on("bufferStalled", () => {
        match(env.state)
          .with(PlayerPlayState.PLAYING, () => PlayerCommon.setState(PlayerPlayState.BUFFERING)(env)())
          .otherwise(() => {});
      });

      dashPlayer.on("bufferLoaded", () => {
        match(env.state)
          .with(PlayerPlayState.BUFFERING, () => PlayerCommon.setState(PlayerPlayState.PLAYING)(env)())
          .otherwise(() => {});
      });

      dashPlayer.on("playbackEnded", () => {
        // dash.js can emit playbackEnded when changing streams (for example in SSAI scenarios),
        const currentTime = env.videoElement.currentTime;
        const duration = env.videoElement.duration;
        const isActuallyEnded = Number.isFinite(duration) && currentTime >= duration - 0.5;
        if (isActuallyEnded) {
          pipe(
            PlayerCommon.setState(PlayerPlayState.FINISHED),
            RIO.flatMap(() => PlayerCommon.emit("ended", {})),
          )(env)();
        }
      });
    }),
  );

const load = (source: PlayerSource): RIO.ReaderIO<DashPlayerEnv, void> =>
  pipe(
    RIO.ask<DashPlayerEnv>(),
    RIO.tapIO((env) => env.setSource(source)),
    RIO.tapIO((env) => PlayerCommon.setState(PlayerPlayState.CONNECTING)(env)),
    RIO.flatMap(() => initDashPlayer),
    RIO.flatMap((dashPlayer) =>
      pipe(
        RIO.ask<DashPlayerEnv>(),
        RIO.flatMapIO((env) => () => {
          if (env.source?.drm) {
            dashPlayer.setProtectionData({
              [env.source.drm.system]: {
                serverURL: env.source.drm.licenseUrl,
                httpRequestHeaders: env.source.drm.headers,
              },
            });
          }
          dashPlayer.attachSource(source.url);
        }),
      ),
    ),
  );

const play = (speed: number): RIO.ReaderIO<DashPlayerEnv, void> =>
  pipe(
    PlayerCommon.play(speed),
    RIO.flatMap(() =>
      pipe(
        RIO.ask<DashPlayerEnv>(),
        RIO.flatMapIO((env) => () => {
          match(speed)
            .with(0, () => env.videoElement.pause())
            .otherwise(() => env.dashPlayer?.play());
        }),
      ),
    ),
  );

const seek = (position: number): RIO.ReaderIO<DashPlayerEnv, void> =>
  pipe(
    RIO.ask<DashPlayerEnv>(),
    RIO.flatMapIO((env) => () => env.dashPlayer?.seek(PlayerCommon.msToSeconds(position))),
  );

const release: RIO.ReaderIO<DashPlayerEnv, void> = pipe(
  RIO.ask<DashPlayerEnv>(),
  RIO.tapIO((env) => () => {
    env.dashPlayer?.reset();
  }),
  RIO.tapIO((env) => env.setDashPlayer(null)),
  RIO.tapIO((env) => env.setSource(null)),
  RIO.flatMap(() => PlayerCommon.setState(PlayerPlayState.IDLE)),
);
