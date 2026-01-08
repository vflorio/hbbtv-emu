import type { PlayerRuntime, PlayerState } from "@hbb-emu/player-runtime";
import * as Runtime from "@hbb-emu/player-runtime";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type * as IOE from "fp-ts/IOEither";
import * as IOO from "fp-ts/IOOption";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import type { PlayerRuntimeFactory } from "../../runtime";
import type { VideoStreamSource } from "./config";
import { VideoStreamError } from "./errors";
import { VideoStreamEvent, type VideoStreamEventListener } from "./events";
import { createErrorFromRuntimeState, mapRuntimeStateToPlayState } from "./mappers";
import { VideoStreamPlayState } from "./state";

/**
 * VideoStream API
 * Exposes video backend capabilities for HbbTV emulator
 */
export type VideoStreamApi = Readonly<{
  /** Underlying HTML video element */
  readonly videoElement: HTMLVideoElement;

  /** Sets the PlayerRuntime instance (injected from outside) */
  setPlayerRuntime: (runtime: PlayerRuntime) => IO.IO<void>;

  /** Loads and starts playing a media source */
  loadSource: (source: VideoStreamSource) => TE.TaskEither<VideoStreamError, void>;

  /** Playback controls */
  play: () => TE.TaskEither<VideoStreamError, void>;
  pause: () => TE.TaskEither<VideoStreamError, void>;
  stop: () => TE.TaskEither<VideoStreamError, void>;
  seek: (position: number) => TE.TaskEither<VideoStreamError, void>;

  /** Resource management */
  release: IO.IO<void>;

  /** Audio control */
  setVolume: (volume: number) => TE.TaskEither<VideoStreamError, void>;
  setMuted: (muted: boolean) => TE.TaskEither<VideoStreamError, void>;

  /** Display control */
  setFullscreen: (fullscreen: boolean) => IO.IO<void>;
  setSize: (width: number, height: number) => IO.IO<void>;

  /** Event handling */
  subscribe: (listener: VideoStreamEventListener) => IO.IO<() => void>;
}>;

/**
 * VideoStream Service
 */
export class VideoStreamService implements VideoStreamApi {
  private runtime: PlayerRuntime | null = null;
  private readonly video: HTMLVideoElement;
  private readonly listeners = new Set<VideoStreamEventListener>();
  private currentState: VideoStreamPlayState = VideoStreamPlayState.idle();
  private stateUnsubscribe: (() => void) | null = null;
  private eventsUnsubscribe: (() => void) | null = null;
  private factory: PlayerRuntimeFactory | null = null;
  private ownsRuntime = false; // Track if we created the runtime (and should destroy it)

  constructor(videoElement?: HTMLVideoElement, playerRuntimeOrFactory?: PlayerRuntime | PlayerRuntimeFactory) {
    this.video = videoElement ?? document.createElement("video");
    this.factory = null;

    // Handle PlayerRuntime or Factory using functional pipeline
    pipe(
      O.fromNullable(playerRuntimeOrFactory),
      O.map((runtimeOrFactory) =>
        pipe(
          "create" in runtimeOrFactory
            ? pipe(
                // It's a factory - create our own runtime
                IO.of(runtimeOrFactory),
                IO.flatMap((factory) => () => {
                  this.factory = factory;
                  this.runtime = factory.create();
                  this.ownsRuntime = true;
                  return this.runtime;
                }),
              )
            : pipe(
                // It's a PlayerRuntime instance - use it (shared)
                IO.of(runtimeOrFactory),
                IO.flatMap((runtime) => () => {
                  this.runtime = runtime;
                  this.ownsRuntime = false;
                  return this.runtime;
                }),
              ),
          IO.flatMap((runtime) => runtime.mount(this.video)),
          IO.flatMap(() => this.setupEventListeners()),
        )(),
      ),
    );
  }

  get videoElement(): HTMLVideoElement {
    return this.video;
  }

  /**
   * Returns the underlying PlayerRuntime instance.
   * This allows apps to integrate player UI components that need direct access to runtime state.
   */
  get playerRuntime(): PlayerRuntime | null {
    return this.runtime;
  }

  /**
   * Sets the PlayerRuntime instance.
   * Called to inject a shared runtime (not owned by this service).
   */
  setPlayerRuntime =
    (runtime: PlayerRuntime): IO.IO<void> =>
    () => {
      pipe(
        IOO.Do,
        IOO.bind("runtime", () => IOO.fromNullable(this.runtime)),
        IOO.matchE(
          () => IO.of(undefined),
          ({ runtime }) =>
            pipe(
              this.cleanupEventListeners(),
              IO.flatMap(() =>
                pipe(
                  this.ownsRuntime && this.factory !== null
                    ? pipe(
                        IOO.fromNullable(this.factory),
                        IOO.map((factory) => factory.destroy(runtime)),
                        IOO.getOrElseW(() => IO.of(undefined)),
                      )
                    : IO.of(undefined),
                ),
              ),
            ),
        ),
      )();

      // Set new runtime (not owned by us)
      this.runtime = runtime;
      this.ownsRuntime = false;
      this.factory = null;

      pipe(
        runtime.mount(this.video),
        IO.flatMap(() => this.setupEventListeners()),
      )();
    };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Loads and starts playing a media source.
   * Pure functional pipeline with explicit side-effect management.
   */
  loadSource = (source: VideoStreamSource): TE.TaskEither<VideoStreamError, void> =>
    pipe(
      TE.fromIOEither(this.getRuntime),
      TE.flatMap((runtime) =>
        pipe(
          TE.fromIO(this.applySourceOptions(source)),
          TE.flatMap(() =>
            pipe(
              runtime.dispatch({
                _tag: "Intent/LoadRequested",
                url: source.url,
              }),
              TE.fromTask,
            ),
          ),
          TE.flatMap(() =>
            pipe(
              source.autoPlay ?? false,
              O.fromPredicate((autoPlay) => autoPlay),
              O.map(() => this.handleAutoPlay(runtime)),
              O.getOrElseW(() => TE.right(undefined)),
            ),
          ),
        ),
      ),
      TE.mapLeft((error) => VideoStreamError.unknown(error instanceof Error ? error.message : "Failed to load source")),
    );

  release = (): IO.IO<void> =>
    pipe(
      this.cleanupEventListeners(),
      IO.flatMap(() =>
        pipe(
          IOO.Do,
          IOO.bind("runtime", () => IOO.fromNullable(this.runtime)),
          IOO.bind("factory", () => IOO.fromNullable(this.factory)),
          IOO.filter(() => this.ownsRuntime),
          IOO.matchE(
            () => IO.of(undefined),
            ({ runtime, factory }) => IO.of(factory.destroy(runtime)),
          ),
        ),
      ),
      IO.flatMap(() => () => {
        this.runtime = null;
        this.factory = null;
      }),
    );

  // ============================================================================
  // Playback Control
  // ============================================================================

  play = (): TE.TaskEither<VideoStreamError, void> =>
    pipe(
      TE.fromIOEither(this.getRuntime),
      TE.flatMap((runtime) => pipe(runtime.dispatch({ _tag: "Intent/PlayRequested" }), TE.fromTask)),
      TE.mapLeft((error) =>
        VideoStreamError.unknown(error instanceof Error ? error.message : "Failed to play", 1, error),
      ),
    );

  pause = (): TE.TaskEither<VideoStreamError, void> =>
    pipe(
      TE.fromIOEither(this.getRuntime),
      TE.flatMap((runtime) => pipe(runtime.dispatch({ _tag: "Intent/PauseRequested" }), TE.fromTask)),
      TE.mapLeft((error) =>
        VideoStreamError.unknown(error instanceof Error ? error.message : "Failed to pause", 1, error),
      ),
    );

  stop = (): TE.TaskEither<VideoStreamError, void> =>
    pipe(
      TE.fromIOEither(this.getRuntime),
      TE.flatMap((runtime) =>
        pipe(
          pipe(runtime.dispatch({ _tag: "Intent/PauseRequested" }), TE.fromTask),
          TE.flatMap(() => pipe(runtime.dispatch({ _tag: "Intent/SeekRequested", time: 0 }), TE.fromTask)),
        ),
      ),
      TE.mapLeft((error) =>
        VideoStreamError.unknown(error instanceof Error ? error.message : "Failed to stop", 1, error),
      ),
    );

  seek = (position: number): TE.TaskEither<VideoStreamError, void> =>
    pipe(
      TE.fromIOEither(this.getRuntime),
      TE.flatMap((runtime) =>
        pipe(
          runtime.dispatch({
            _tag: "Intent/SeekRequested",
            time: position / 1000, // Position is in milliseconds, convert to seconds
          }),
          TE.fromTask,
        ),
      ),
      TE.mapLeft((error) =>
        VideoStreamError.unknown(error instanceof Error ? error.message : "Failed to seek", 1, error),
      ),
    );

  // ============================================================================
  // Audio Control
  // ============================================================================

  setVolume = (volume: number): TE.TaskEither<VideoStreamError, void> =>
    pipe(
      TE.fromIOEither(this.getRuntime),
      TE.flatMap((runtime) =>
        pipe(
          runtime.dispatch({
            _tag: "Intent/SetVolumeRequested",
            volume: Math.max(0, Math.min(100, volume)) / 100, // Volume is 0-100, convert to 0-1
          }),
          TE.fromTask,
        ),
      ),
      TE.mapLeft((error) =>
        VideoStreamError.unknown(error instanceof Error ? error.message : "Failed to set volume", 1, error),
      ),
    );

  setMuted = (muted: boolean): TE.TaskEither<VideoStreamError, void> =>
    pipe(
      TE.fromIOEither(this.getRuntime),
      TE.flatMap((runtime) =>
        pipe(
          runtime.dispatch({
            _tag: "Intent/SetMutedRequested",
            muted,
          }),
          TE.fromTask,
        ),
      ),
      TE.mapLeft((error) =>
        VideoStreamError.unknown(error instanceof Error ? error.message : "Failed to set muted", 1, error),
      ),
    );

  // ============================================================================
  // Display Control
  // ============================================================================

  setFullscreen = (fullscreen: boolean): IO.IO<void> =>
    pipe(
      O.some(fullscreen),
      O.match(
        () => IO.of(this.video.removeAttribute("style")),
        () => IO.of(this.video.setAttribute("style", "width: 100%; height: 100%;")),
      ),
    );

  setSize = (width: number, height: number): IO.IO<void> =>
    IO.of(this.video.setAttribute("style", `width: ${width}px; height: ${height}px;`));

  // ============================================================================
  // Event Handling
  // ============================================================================

  subscribe = (listener: VideoStreamEventListener): IO.IO<() => void> =>
    pipe(
      IO.of(this.listeners.add(listener)),
      IO.map(() => () => this.listeners.delete(listener)),
    );

  // ============================================================================
  // Private Methods - Pure Functional Helpers
  // ============================================================================

  /**
   * Get runtime or return error.
   * Pure IOEither that fails if runtime is not initialized.
   */
  private getRuntime: IOE.IOEither<VideoStreamError, PlayerRuntime> = () =>
    pipe(
      this.runtime,
      E.fromNullable(VideoStreamError.notInitialized("PlayerRuntime not set, cannot perform operation")),
    );

  /**
   * Apply source options to video element.
   * Pure side effect wrapped in IO.
   */
  private applySourceOptions = (source: VideoStreamSource): IO.IO<void> =>
    pipe(
      IO.Do,
      IO.flatMap(() =>
        pipe(
          O.fromNullable(source.muted),
          O.map((muted) => () => {
            this.video.muted = muted;
          }),
          O.getOrElseW(() => IO.of(undefined)),
        ),
      ),
      IO.flatMap(() =>
        pipe(
          O.fromNullable(source.loop),
          O.map((loop) => () => {
            this.video.loop = loop;
          }),
          O.getOrElseW(() => IO.of(undefined)),
        ),
      ),
      IO.flatMap(() =>
        pipe(
          O.fromNullable(source.autoPlay),
          O.map((autoPlay) => () => {
            this.video.autoplay = autoPlay;
          }),
          O.getOrElseW(() => IO.of(undefined)),
        ),
      ),
    );

  /**
   * Handle auto-play by subscribing to playable state.
   * Returns TaskEither to signal async completion.
   */
  private handleAutoPlay = (runtime: PlayerRuntime): TE.TaskEither<VideoStreamError, void> =>
    TE.tryCatch(
      () =>
        new Promise<void>((resolve) => {
          const unsubscribe = runtime.subscribeToState((state: PlayerState.Any) => {
            pipe(
              state,
              O.fromPredicate((s) => Runtime.isPaused(s) && Runtime.isPlayable(s)),
              O.map(() => {
                runtime.dispatch({ _tag: "Intent/PlayRequested" })();
                unsubscribe();
                resolve();
              }),
            );
          });
        }),
      (): VideoStreamError => VideoStreamError.unknown("Failed to handle auto-play"),
    );

  /**
   * Setup event listeners for runtime state and events.
   * Pure functional pipeline that returns cleanup function.
   */
  private setupEventListeners = (): IO.IO<void> =>
    pipe(
      IOO.fromNullable(this.runtime),
      IOO.matchE(
        () => IO.of(undefined),
        (runtime) =>
          pipe(
            IO.Do,
            IO.flatMap(() => this.setupStateSubscription(runtime)),
            IO.flatMap(() => this.setupEventsSubscription(runtime)),
          ),
      ),
    );

  /**
   * Setup state subscription.
   * Emits state changes and time updates using functional matchers.
   */
  private setupStateSubscription =
    (runtime: PlayerRuntime): IO.IO<void> =>
    () => {
      this.stateUnsubscribe = runtime.subscribeToState((state: PlayerState.Any) => {
        const newPlayState = mapRuntimeStateToPlayState(state);
        const previousPlayState = this.currentState;

        // Emit state change if state differs
        pipe(
          newPlayState,
          O.fromPredicate((newState) => newState._tag !== previousPlayState._tag),
          O.map((newState) => {
            this.currentState = newState;
            this.emit(VideoStreamEvent.stateChange(newState, previousPlayState))();
          }),
        );

        // Emit time updates for playable states using type guards
        pipe(
          state,
          O.fromPredicate(Runtime.hasTimeInfo),
          O.map((timeState) => {
            const currentTime = Runtime.getCurrentTime(timeState);
            const duration = Runtime.getDuration(timeState);

            pipe(
              currentTime,
              O.fromNullable,
              O.map((time) => this.emit(VideoStreamEvent.timeUpdate(Math.floor(time * 1000)))()),
            );

            pipe(
              duration,
              O.fromNullable,
              O.map((dur) => this.emit(VideoStreamEvent.durationChange(Math.floor(dur * 1000)))()),
            );
          }),
        );

        // Handle ended state and errors with match
        match(state)
          .when(Runtime.isEnded, () => {
            this.emit(VideoStreamEvent.ended())();
          })
          .when(Runtime.isError, (errorState) => {
            this.emit(VideoStreamEvent.error(createErrorFromRuntimeState(errorState)))();
          })
          .otherwise(() => {});
      });
    };

  /**
   * Setup events subscription.
   * Handles volume changes and other runtime events.
   */
  private setupEventsSubscription =
    (runtime: PlayerRuntime): IO.IO<void> =>
    () => {
      this.eventsUnsubscribe = runtime.subscribeToEvents((event: any) => {
        match(event)
          .when(Runtime.isVolumeChangeEvent, (e) => {
            this.emit(VideoStreamEvent.volumeChange(Math.round(e.volume * 100), e.muted))();
          })
          .when(Runtime.isAdapterCreatedEvent, () => {
            // Adapter successfully created and attached
          })
          .when(Runtime.isAdapterDestroyedEvent, () => {
            // Adapter destroyed
          })
          .when(Runtime.isMetadataLoadedEvent, () => {
            // Metadata loaded, might be useful for duration events
          })
          .otherwise(() => {
            // Ignore other adapter-specific events
          });
      });
    };

  /**
   * Cleanup event listeners.
   * Pure side effect wrapped in IO.
   */
  private cleanupEventListeners = (): IO.IO<void> =>
    pipe(
      IO.Do,
      IO.flatMap(() =>
        pipe(
          IOO.fromNullable(this.stateUnsubscribe),
          IOO.matchE(
            () => IO.of(undefined),
            (unsubscribe) => () => {
              unsubscribe();
              this.stateUnsubscribe = null;
            },
          ),
        ),
      ),
      IO.flatMap(() =>
        pipe(
          IOO.fromNullable(this.eventsUnsubscribe),
          IOO.matchE(
            () => IO.of(undefined),
            (unsubscribe) => () => {
              unsubscribe();
              this.eventsUnsubscribe = null;
            },
          ),
        ),
      ),
    );

  /**
   * Emit event to all registered listeners.
   * Pure functional pipeline that handles errors gracefully.
   */
  private emit = (event: VideoStreamEvent): IO.IO<void> =>
    pipe(
      [...this.listeners],
      RA.traverse(IO.Applicative)((listener) =>
        pipe(
          E.tryCatch(
            () => listener(event),
            (error) => {
              console.error(`Error in ${event._tag} listener:`, error);
              return error;
            },
          ),
          E.fold(
            () => IO.of(undefined),
            () => IO.of(undefined),
          ),
        ),
      ),
      IO.asUnit,
    );
}
