import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { VideoStreamEnv } from "./env";
import type { Player, PlayerSource, PlayerSourceType } from "./players";

const resolveSourceType = (deps: VideoStreamEnv, source: PlayerSource): PlayerSourceType =>
  source.type ?? deps.detectSourceType(source.url);

export type VideoStreamApi = Readonly<{
  /** Underlying HTML video element used by the visual attach strategy */
  readonly videoElement: HTMLVideoElement;

  /** Loads a media source, switching Player when needed */
  loadSource: (source: PlayerSource) => IO.IO<void>;

  /** Playback controls */
  play: (speed?: number) => IO.IO<void>;
  pause: () => IO.IO<void>;
  stop: () => IO.IO<void>;

  /** Resource management */
  release: () => IO.IO<void>;
}>;

export class VideoStreamService implements VideoStreamApi {
  #player: Player;

  constructor(private readonly env: VideoStreamEnv) {
    this.#player = env.createPlayer("video");
    this.#player.setupListeners()();
  }

  get videoElement(): HTMLVideoElement {
    return this.#player.videoElement;
  }

  /**
   * Ensures we have the right Player instance for the desired source type.
   */
  private ensurePlayerFor =
    (sourceType: PlayerSourceType): IO.IO<void> =>
    () => {
      if (this.#player.sourceType === sourceType) return;

      // release old player
      this.#player.release()();

      // switch to a new player
      const next = this.env.createPlayer(sourceType);
      next.setupListeners()();
      this.#player = next;
    };

  loadSource = (source: PlayerSource): IO.IO<void> =>
    pipe(
      IO.of(resolveSourceType(this.env, source)),
      IO.flatMap((sourceType) => this.ensurePlayerFor(sourceType)),
      IO.flatMap(() => this.#player.load(source)),
    );

  play = (speed?: number): IO.IO<void> => this.#player.play(speed);
  pause = (): IO.IO<void> => this.#player.pause();
  stop = (): IO.IO<void> => this.#player.stop();

  release = (): IO.IO<void> => this.#player.release();
}
