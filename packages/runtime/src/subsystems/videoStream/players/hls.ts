import { createLogger } from "@hbb-emu/core";
import { addEventListener } from "@hbb-emu/core/dom";
import { sequenceT } from "fp-ts/Apply";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RIO from "fp-ts/ReaderIO";
import Hls from "hls.js";
import { match } from "ts-pattern";
import type { Player, PlayerEventListener, PlayerEventType, PlayerSource } from ".";
import { PlayerPlayState } from ".";
import * as PlayerCommon from "./common";

const logger = createLogger("HlsPlayer");

type HlsPlayerEnv = PlayerCommon.PlayerEnv & {
  hlsPlayer: Hls | null;
  setHlsPlayer: (player: Hls | null) => IO.IO<void>;
};

export class HlsPlayer implements Player {
  readonly sourceType = "hls" as const;
  readonly videoElement: HTMLVideoElement;

  readonly #env: HlsPlayerEnv;
  #state: PlayerPlayState = PlayerPlayState.IDLE;
  #source: PlayerSource | null = null;
  #currentSpeed = 1;
  #hlsPlayer: Hls | null = null;

  constructor() {
    this.videoElement = document.createElement("video");

    this.#env = {
      state: this.#state,
      source: this.#source,
      currentSpeed: this.#currentSpeed,
      listeners: PlayerCommon.createEventListeners(),
      videoElement: this.videoElement,
      hlsPlayer: this.#hlsPlayer,
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
      setHlsPlayer: (player) => () => {
        this.#hlsPlayer = player;
        this.#env.hlsPlayer = player;
      },
    };
  }

  load = (source: PlayerSource): IO.IO<void> => load(source)(this.#env);
  release = (): IO.IO<void> => release(this.#env);
  setupListeners = (): IO.IO<void> => setupVideoEventListeners(this.#env);

  play = (speed = 1): IO.IO<void> => play(speed)(this.#env);
  pause = (): IO.IO<void> => PlayerCommon.pause()(this.#env);
  stop = (): IO.IO<void> => PlayerCommon.stop()(this.#env);
  seek = (position: number): IO.IO<void> => PlayerCommon.seek(position)(this.#env);

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

const setupVideoEventListeners: RIO.ReaderIO<HlsPlayerEnv, void> = (env) =>
  sequenceT(IO.Applicative)(
    addEventListener(env.videoElement)("playing")(() => PlayerCommon.setState(PlayerPlayState.PLAYING)(env)()),
    addEventListener(env.videoElement)("pause")(() =>
      match(env.state)
        .with(PlayerPlayState.PLAYING, () => PlayerCommon.setState(PlayerPlayState.PAUSED)(env)())
        .otherwise(() => {}),
    ),
    addEventListener(env.videoElement)("ended")(() =>
      pipe(
        PlayerCommon.setState(PlayerPlayState.FINISHED),
        RIO.flatMap(() => PlayerCommon.emit("ended", {})),
      )(env)(),
    ),
    addEventListener(env.videoElement)("timeupdate")(() =>
      PlayerCommon.emit("timeupdate", { currentTime: PlayerCommon.getCurrentTimeMs(env.videoElement) })(env)(),
    ),
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

const initHlsPlayer = async (env: HlsPlayerEnv): Promise<Hls> => {
  if (env.hlsPlayer) {
    return env.hlsPlayer;
  }

  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: false,
  });

  hls.attachMedia(env.videoElement);
  setupHlsEventHandlers(hls, Hls, env);
  env.setHlsPlayer(hls)();

  return hls;
};

const setupHlsEventHandlers = (hls: Hls, HlsClass: typeof import("hls.js").default, env: HlsPlayerEnv): void => {
  hls.on(HlsClass.Events.ERROR, (_event, data) => {
    if (data.fatal) {
      pipe(
        PlayerCommon.setState(PlayerPlayState.ERROR),
        RIO.flatMap(() => PlayerCommon.emit("error", { error: PlayerCommon.createHlsError(data) })),
      )(env)();
    }
  });

  hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
    logger.debug("HLS manifest parsed")();
  });

  hls.on(HlsClass.Events.FRAG_BUFFERED, () => {
    match(env.state)
      .with(PlayerPlayState.BUFFERING, () => PlayerCommon.setState(PlayerPlayState.PLAYING)(env)())
      .otherwise(() => {});
  });
};

const load = (source: PlayerSource): RIO.ReaderIO<HlsPlayerEnv, void> =>
  pipe(
    RIO.ask<HlsPlayerEnv>(),
    RIO.tapIO(() => logger.debug("Loading HLS source:", source.url)),
    RIO.tapIO((env) => env.setSource(source)),
    RIO.tapIO((env) => PlayerCommon.setState(PlayerPlayState.CONNECTING)(env)),
    RIO.flatMapIO((env) => () => {
      initHlsPlayer(env)
        .then((hls) => {
          hls.loadSource(source.url);
        })
        .catch((err) => {
          logger.error("HLS init failed:", err)();
          pipe(
            PlayerCommon.setState(PlayerPlayState.ERROR),
            RIO.flatMap(() => PlayerCommon.emit("error", { error: { code: 0, message: String(err) } })),
          )(env)();
        });
    }),
  );

const play = (speed: number): RIO.ReaderIO<HlsPlayerEnv, void> =>
  pipe(
    PlayerCommon.play(speed),
    RIO.flatMap(() =>
      pipe(
        RIO.ask<HlsPlayerEnv>(),
        RIO.flatMapIO((env) => () => {
          match(speed)
            .with(0, () => env.videoElement.pause())
            .otherwise(() => {
              env.videoElement.play().catch((err: unknown) => {
                logger.error("Play failed:", err)();
                pipe(
                  PlayerCommon.setState(PlayerPlayState.ERROR),
                  RIO.flatMap(() => PlayerCommon.emit("error", { error: { code: 0, message: String(err) } })),
                )(env)();
              });
            });
        }),
      ),
    ),
  );

const release: RIO.ReaderIO<HlsPlayerEnv, void> = pipe(
  RIO.ask<HlsPlayerEnv>(),
  RIO.tapIO((env) => () => {
    env.hlsPlayer?.destroy();
  }),
  RIO.tapIO((env) => env.setHlsPlayer(null)),
  RIO.tapIO((env) => env.setSource(null)),
  RIO.flatMap(() => PlayerCommon.setState(PlayerPlayState.IDLE)),
);
