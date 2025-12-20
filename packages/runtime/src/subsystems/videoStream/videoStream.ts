import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as TE from "fp-ts/TaskEither";
import type { VideoStreamEnv } from "./env";
import type { Player, PlayerEventListener, PlayerEventType, PlayerSource, PlayerSourceType } from "./players";

const resolveSourceType = (deps: VideoStreamEnv, source: PlayerSource): PlayerSourceType =>
  source.type ?? deps.detectSourceType(source.url);

export type VideoStreamApi = Readonly<{
  /** Underlying HTML video element used by the visual attach strategy */
  readonly videoElement: HTMLVideoElement;

  /** Loads a media source, switching Player when needed */
  loadSource: (source: PlayerSource) => IO.IO<void>;

  /** Playback controls */
  play: () => TE.TaskEither<Error, void>;
  pause: IO.IO<void>;
  stop: IO.IO<void>;
  seek: (position: number) => IO.IO<void>;

  /** Resource management */
  release: IO.IO<void>;

  /** Audio control */
  setVolume: (volume: number) => IO.IO<void>;
  setMuted: (muted: boolean) => IO.IO<void>;

  /** Display control */
  setFullscreen: (fullscreen: boolean) => IO.IO<void>;
  setSize: (width: number, height: number) => IO.IO<void>;

  /** Event handling */
  on: <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>) => IO.IO<void>;
  off: <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>) => IO.IO<void>;
}>;

export class VideoStreamService implements VideoStreamApi {
  #player: Player;
  #externalListeners: Map<PlayerEventType, Set<PlayerEventListener<any>>>;
  readonly #videoElement: HTMLVideoElement;

  constructor(private readonly env: VideoStreamEnv) {
    // Create a single persistent videoElement that will be reused across player switches
    this.#videoElement = document.createElement("video");
    this.#player = env.createPlayer("video", this.#videoElement);
    this.#player.setupListeners()();
    this.#externalListeners = new Map();
  }

  get videoElement(): HTMLVideoElement {
    return this.#videoElement;
  }

  /**
   * Ensures we have the right Player instance for the desired source type.
   * Reuses the same videoElement to maintain visual attachment consistency.
   */
  private ensurePlayerFor =
    (sourceType: PlayerSourceType): IO.IO<void> =>
    () => {
      if (this.#player.sourceType === sourceType) return;

      // release old player
      this.#player.release()();

      // switch to a new player, reusing the same videoElement
      const next = this.env.createPlayer(sourceType, this.#videoElement);
      next.setupListeners()();
      this.#player = next;

      // Re-attach external listeners to the new player
      for (const [type, listeners] of this.#externalListeners.entries()) {
        for (const listener of listeners) {
          this.#player.on(type as any, listener as any)();
        }
      }
    };

  loadSource = (source: PlayerSource): IO.IO<void> =>
    pipe(
      IO.of(resolveSourceType(this.env, source)),
      IO.flatMap((sourceType) => this.ensurePlayerFor(sourceType)),
      IO.flatMap(() => this.#player.load(source)),
    );

  play = (): TE.TaskEither<Error, void> => this.#player.play();
  pause = (): IO.IO<void> => this.#player.pause();
  stop = (): IO.IO<void> => this.#player.stop();
  seek = (position: number): IO.IO<void> => this.#player.seek(position);

  release = (): IO.IO<void> => this.#player.release();

  setVolume = (volume: number): IO.IO<void> => this.#player.setVolume(volume);
  setMuted = (muted: boolean): IO.IO<void> => this.#player.setMuted(muted);

  setFullscreen = (fullscreen: boolean): IO.IO<void> => this.#player.setFullscreen(fullscreen);
  setSize = (width: number, height: number): IO.IO<void> => this.#player.setSize(width, height);

  on =
    <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void> =>
    () => {
      const set = this.#externalListeners.get(type) ?? new Set<PlayerEventListener<any>>();
      set.add(listener as any);
      this.#externalListeners.set(type, set);
      this.#player.on(type, listener)();
    };

  off =
    <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void> =>
    () => {
      const set = this.#externalListeners.get(type);
      set?.delete(listener as any);
      this.#player.off(type, listener)();
    };
}
