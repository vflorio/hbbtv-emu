import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import * as RIO from "fp-ts/ReaderIO";
import { match } from "ts-pattern";
import type { Player } from "./players";
import { DashPlayer } from "./players/dash";
import { HlsPlayer } from "./players/hls";
import { HtmlVideoPlayer } from "./players/video";
import type { MediaSource, MediaSourceType, PlayerEventListener, PlayerEventType, StreamPlayState } from "./types";

const logger = createLogger("VideoStream");

// Types

type StateChangeListener = (state: StreamPlayState, previousState: StreamPlayState) => void;

// Environment

export type VideoStreamEnv = {
  player: Player;
  setPlayer: (player: Player) => IO.IO<void>;
};

// Factory

const createPlayer = (sourceType: MediaSourceType): Player =>
  match(sourceType)
    .with("video", () => new HtmlVideoPlayer())
    .with("dash", () => new DashPlayer())
    .with("hls", () => new HlsPlayer())
    .exhaustive();

export const createVideoStreamEnv = (stream: ObjectVideoStream): VideoStreamEnv => ({
  player: stream.player,
  setPlayer: (player) => () => {
    stream.player = player;
  },
});

// Methods

const detectSourceType = (url: string): MediaSourceType =>
  match(url.toLowerCase())
    .when(
      (url) => url.endsWith(".mpd") || url.includes("dash"),
      () => "dash" as MediaSourceType,
    )
    .when(
      (url) => url.endsWith(".m3u8") || url.includes("hls"),
      () => "hls" as MediaSourceType,
    )
    .otherwise(() => "video" as MediaSourceType);

export const initializePlayer = (sourceType: MediaSourceType): RIO.ReaderIO<VideoStreamEnv, void> =>
  pipe(
    RIO.ask<VideoStreamEnv>(),
    RIO.tapIO(() => logger.debug("Initializing player for source type:", sourceType)),
    RIO.flatMap((env) =>
      match(sourceType === env.player.sourceType)
        .with(true, () => RIO.of<VideoStreamEnv, void>(undefined))
        .with(false, () =>
          pipe(
            releasePlayer,
            RIO.flatMap(() =>
              pipe(
                RIO.ask<VideoStreamEnv>(),
                RIO.tapIO((env) => () => {
                  const newPlayer = createPlayer(sourceType);
                  newPlayer.setupListeners()();
                  env.setPlayer(newPlayer)();
                }),
                RIO.map(() => undefined),
              ),
            ),
          ),
        )
        .exhaustive(),
    ),
  );

export const loadSource = (source: MediaSource): RIO.ReaderIO<VideoStreamEnv, void> =>
  pipe(
    RIO.of(source.type ?? detectSourceType(source.url)),
    RIO.tapIO((sourceType) => logger.debug("Loading source:", source.url, "type:", sourceType)),
    RIO.flatMap((sourceType) => initializePlayer(sourceType)),
    RIO.flatMap(() =>
      pipe(
        RIO.ask<VideoStreamEnv>(),
        RIO.flatMapIO((env) => env.player.load(source)),
      ),
    ),
  );

export const releasePlayer: RIO.ReaderIO<VideoStreamEnv, void> = pipe(
  RIO.ask<VideoStreamEnv>(),
  RIO.tapIO(() => logger.debug("Releasing player")),
  RIO.flatMapIO((env) => env.player.release()),
);

// FIXME
export const createStandaloneVideoStreamEnv = (): VideoStreamEnv => {
  let player: Player = createPlayer("video");
  player.setupListeners()();

  return {
    player,
    setPlayer: (newPlayer) => () => {
      player = newPlayer;
    },
  };
};

// FIXME
export class ObjectVideoStream {
  #stateChangeListeners: Set<StateChangeListener> = new Set();
  #videoStreamEnvCache: VideoStreamEnv | null = null;
  #player: Player = createPlayer("video");

  constructor() {
    this.#player.setupListeners()();
    this.setupStateChangeListener();
    logger.info("initialized")();
  }

  /** @internal */
  get _videoStreamEnv(): VideoStreamEnv {
    if (!this.#videoStreamEnvCache) {
      this.#videoStreamEnvCache = createVideoStreamEnv(this);
    }
    return this.#videoStreamEnvCache;
  }

  get player(): Player {
    return this.#player;
  }

  set player(player: Player) {
    this.#player = player;
    // Invalidate cache when player changes
    this.#videoStreamEnvCache = null;
  }

  get currentSourceType(): MediaSourceType {
    return this.#player.sourceType;
  }

  get videoElement(): HTMLVideoElement {
    return this.#player.videoElement;
  }

  // Wrapper methods - now delegating directly to player interface

  loadSource = (source: MediaSource): IO.IO<void> => loadSource(source)(this._videoStreamEnv);

  releasePlayer = (): IO.IO<void> => releasePlayer(this._videoStreamEnv);

  videoStreamPlay = (speed?: number): IO.IO<void> => this.#player.play(speed);

  videoStreamPause = (): IO.IO<void> => this.#player.pause();

  videoStreamStop = (): IO.IO<void> => this.#player.stop();

  videoStreamSeek = (position: number): IO.IO<void> => this.#player.seek(position);

  videoStreamSetVolume = (volume: number): IO.IO<void> => this.#player.setVolume(volume);

  videoStreamSetMuted = (muted: boolean): IO.IO<void> => this.#player.setMuted(muted);

  videoStreamSetFullscreen = (fullscreen: boolean): IO.IO<void> => this.#player.setFullscreen(fullscreen);

  videoStreamSetSize = (width: number, height: number): IO.IO<void> => this.#player.setSize(width, height);

  // Event handling

  setupStateChangeListener: IO.IO<void> = () => {
    this.#player.on("statechange", (event) => {
      logger.debug("Stream state change:", event.previousState, "->", event.state)();

      for (const listener of this.#stateChangeListeners) {
        try {
          listener(event.state, event.previousState);
        } catch (err) {
          logger.error("State change listener error:", err)();
        }
      }
    })();
  };

  onStreamStateChange = (listener: StateChangeListener): (() => void) => {
    this.#stateChangeListeners.add(listener);
    return () => this.#stateChangeListeners.delete(listener);
  };

  onPlayerEvent = <E extends PlayerEventType>(type: E, listener: PlayerEventListener<E>): (() => void) => {
    this.#player.on(type, listener)();
    return () => this.#player.off(type, listener)();
  };
}
