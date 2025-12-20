import { addEventListener } from "@hbb-emu/core/dom";
import { sequenceT } from "fp-ts/Apply";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RIO from "fp-ts/ReaderIO";
import type * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import type { Player, PlayerEventListener, PlayerEventType, PlayerSource } from ".";
import { PlayerPlayState } from ".";
import * as PlayerCommon from "./common";

type HtmlVideoPlayerEnv = PlayerCommon.PlayerEnv;

export class HtmlVideoPlayer implements Player {
  readonly sourceType = "video" as const;
  readonly videoElement: HTMLVideoElement;

  readonly #env: HtmlVideoPlayerEnv;
  #state: PlayerPlayState = PlayerPlayState.IDLE;
  #source: PlayerSource | null = null;
  #currentSpeed = 1;

  constructor(videoElement?: HTMLVideoElement) {
    this.videoElement = videoElement ?? document.createElement("video");

    this.#env = {
      state: this.#state,
      source: this.#source,
      currentSpeed: this.#currentSpeed,
      listeners: PlayerCommon.createEventListeners(),
      videoElement: this.videoElement,
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
    };

    if (!videoElement) return;
    videoElement.removeAttribute("src");
    videoElement.load();
  }

  load = (source: PlayerSource): IO.IO<void> => load(source)(this.#env);
  setupListeners = (): IO.IO<void> => setupVideoEventListeners(this.#env);

  release = (): IO.IO<void> => PlayerCommon.release()(this.#env);
  play = (): TE.TaskEither<Error, void> => PlayerCommon.play(1)(this.#env);
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

const setupVideoEventListeners: RIO.ReaderIO<HtmlVideoPlayerEnv, void> = (env) =>
  sequenceT(IO.Applicative)(
    addEventListener(env.videoElement)("loadstart")(() =>
      match(env.state)
        .with(PlayerPlayState.IDLE, () => PlayerCommon.setState(PlayerPlayState.CONNECTING)(env)())
        .otherwise(() => {}),
    ),
    addEventListener(env.videoElement)("playing")(() => PlayerCommon.setState(PlayerPlayState.PLAYING)(env)()),
    addEventListener(env.videoElement)("pause")(() =>
      match(env.state)
        .with(PlayerPlayState.PLAYING, () => PlayerCommon.setState(PlayerPlayState.PAUSED)(env)())
        .otherwise(() => {}),
    ),
    addEventListener(env.videoElement)("waiting")(() =>
      match(env.state)
        .with(PlayerPlayState.PLAYING, () => PlayerCommon.setState(PlayerPlayState.BUFFERING)(env)())
        .otherwise(() => {}),
    ),
    addEventListener(env.videoElement)("ended")(() =>
      pipe(
        PlayerCommon.setState(PlayerPlayState.FINISHED),
        RIO.flatMap(() => PlayerCommon.emit("ended", {})),
      )(env)(),
    ),
    addEventListener(env.videoElement)("error")(() =>
      pipe(
        PlayerCommon.setState(PlayerPlayState.ERROR),
        RIO.flatMap(() => PlayerCommon.emit("error", { error: PlayerCommon.createVideoError(env.videoElement) })),
      )(env)(),
    ),
    addEventListener(env.videoElement)("timeupdate")(() =>
      PlayerCommon.emit("timeupdate", { currentTime: PlayerCommon.getCurrentTimeMs(env.videoElement) })(env)(),
    ),
    addEventListener(env.videoElement)("durationchange")(() =>
      PlayerCommon.emit("durationchange", { duration: PlayerCommon.getDurationMs(env.videoElement) })(env)(),
    ),
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

const load = (source: PlayerSource): RIO.ReaderIO<HtmlVideoPlayerEnv, void> =>
  pipe(
    PlayerCommon.loadSource(source),
    RIO.flatMap(() =>
      pipe(
        RIO.ask<HtmlVideoPlayerEnv>(),
        RIO.flatMapIO((env) => () => {
          env.videoElement.src = source.url;
          env.videoElement.load();
        }),
      ),
    ),
  );
