import { createLogger } from "@hbb-emu/core";
import { addEventListener } from "@hbb-emu/core/dom";
import { sequenceT } from "fp-ts/Apply";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RIO from "fp-ts/ReaderIO";
import * as RTE from "fp-ts/ReaderTaskEither";
import type * as TE from "fp-ts/TaskEither";
import Hls, { Events } from "hls.js";
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

  constructor(videoElement?: HTMLVideoElement) {
    this.videoElement = videoElement ?? document.createElement("video");

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

    if (!videoElement) return;
    videoElement.removeAttribute("src");
    videoElement.load();
  }

  load = (source: PlayerSource): IO.IO<void> => load(source)(this.#env);
  release = (): IO.IO<void> => release(this.#env);
  setupListeners = (): IO.IO<void> => setupVideoEventListeners(this.#env);

  play = (): TE.TaskEither<Error, void> => play()(this.#env);
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

const initHlsPlayer: RTE.ReaderTaskEither<HlsPlayerEnv, Error, Hls> = pipe(
  RTE.ask<HlsPlayerEnv>(),
  RTE.map(
    (env) =>
      env.hlsPlayer ??
      new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      }),
  ),
  RTE.tapReaderIO((hls) =>
    pipe(
      RIO.ask<HlsPlayerEnv>(),
      RIO.flatMap((env) =>
        env.hlsPlayer
          ? RIO.Do
          : pipe(
              RIO.Do,
              RIO.tapIO(() => IO.of(hls.attachMedia(env.videoElement))),
              RIO.flatMap(() => setupHlsEventHandlers(hls)),
              RIO.tapIO(() => env.setHlsPlayer(hls)),
            ),
      ),
    ),
  ),
);

const setupHlsEventHandlers = (hls: Hls): RIO.ReaderIO<HlsPlayerEnv, void> =>
  pipe(
    RIO.ask<HlsPlayerEnv>(),
    RIO.tapIO((env) => () => {
      hls.on(
        Events.ERROR,
        (_event, data) =>
          data.fatal &&
          pipe(
            PlayerCommon.setState(PlayerPlayState.ERROR),
            RIO.flatMap(() => PlayerCommon.emit("error", { error: PlayerCommon.createHlsError(data) })),
          )(env)(),
      );

      hls.on(Events.MANIFEST_PARSED, () => {
        logger.debug("HLS manifest parsed")();
      });

      hls.on(Events.FRAG_BUFFERED, () => {
        match(env.state)
          .with(PlayerPlayState.BUFFERING, () => PlayerCommon.setState(PlayerPlayState.PLAYING)(env)())
          .otherwise(() => {});
      });
    }),
  );

const load = (source: PlayerSource): RTE.ReaderTaskEither<HlsPlayerEnv, Error, void> =>
  pipe(
    RTE.ask<HlsPlayerEnv>(),
    RTE.tapIO(() => logger.debug("Loading HLS source:", source.url)),
    RTE.tapIO((env) => env.setSource(source)),
    RTE.tapIO((env) => PlayerCommon.setState(PlayerPlayState.CONNECTING)(env)),
    RTE.flatMap(() =>
      pipe(
        initHlsPlayer,
        RTE.tapIO((hls) => () => hls.loadSource(source.url)),
        RTE.tapError((err) => RTE.fromIO(() => logger.error("HLS init failed:", err))),
        RTE.map(() => undefined),
      ),
    ),
  );

const play = (): RTE.ReaderTaskEither<HlsPlayerEnv, Error, void> => PlayerCommon.play(1);

const release: RIO.ReaderIO<HlsPlayerEnv, void> = pipe(
  RIO.ask<HlsPlayerEnv>(),
  RIO.tapIO((env) => () => {
    env.hlsPlayer?.destroy();
  }),
  RIO.tapIO((env) => env.setHlsPlayer(null)),
  RIO.tapIO((env) => env.setSource(null)),
  RIO.flatMap(() => PlayerCommon.setState(PlayerPlayState.IDLE)),
);
