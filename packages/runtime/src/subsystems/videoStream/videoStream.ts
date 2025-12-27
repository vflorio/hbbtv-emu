/**
 * VideoStream Service
 * Video backend provider for HbbTV emulator
 * Direct bridge to @hbb-emu/player-runtime
 */

import type { PlayerRuntime, PlayerState } from "@hbb-emu/player-runtime";
import * as Runtime from "@hbb-emu/player-runtime";
import type * as IO from "fp-ts/IO";
import type * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import type { PlayerRuntimeFactory } from "../../runtime";
import type {
  VideoStreamError,
  VideoStreamEvent,
  VideoStreamEventListener,
  VideoStreamEventType,
  VideoStreamPlayState,
  VideoStreamSource,
} from "./types";
import { VideoStreamPlayState as PlayState } from "./types";

/**
 * Maps PlayerRuntime states to VideoStream play states using matchers
 */
const mapRuntimeStateToPlayState = (state: PlayerState.Any): VideoStreamPlayState =>
  match(state)
    .when(Runtime.isError, () => PlayState.ERROR)
    .when(Runtime.isPlaying, () => PlayState.PLAYING)
    .when(Runtime.isPaused, () => PlayState.PAUSED)
    .when(Runtime.isLoading, () => PlayState.BUFFERING)
    .when(Runtime.isBuffering, () => PlayState.BUFFERING)
    .when(Runtime.isSeeking, () => PlayState.BUFFERING)
    .when(Runtime.isEnded, () => PlayState.FINISHED)
    .when(Runtime.isIdle, () => PlayState.IDLE)
    .otherwise(() => PlayState.IDLE);

/**
 * Creates a VideoStreamError from PlayerRuntime error state
 */
const createErrorFromRuntimeState = (state: PlayerState.Errors): VideoStreamError => ({
  code: Runtime.matchPlayerState<number>(state)
    .with({ _tag: "Error/Network" }, () => 2)
    .with({ _tag: "Error/NotSupported" }, () => 4)
    .with({ _tag: "Error/DRM" }, () => 6)
    .otherwise(() => 1),
  message: state.error.message,
  details: state,
});

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
  loadSource: (source: VideoStreamSource) => IO.IO<void>;

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
  on: <T extends VideoStreamEventType>(type: T, listener: VideoStreamEventListener<T>) => IO.IO<void>;
  off: <T extends VideoStreamEventType>(type: T, listener: VideoStreamEventListener<T>) => IO.IO<void>;
}>;

/**
 * VideoStream Service Implementation
 * Direct bridge to PlayerRuntime without intermediate abstractions
 */
export class VideoStreamService implements VideoStreamApi {
  #runtime: PlayerRuntime | null = null;
  readonly #videoElement: HTMLVideoElement;
  readonly #eventListeners: Map<VideoStreamEventType, Set<VideoStreamEventListener<any>>>;
  #currentState: VideoStreamPlayState = PlayState.IDLE;
  #stateUnsubscribe: (() => void) | null = null;
  #eventsUnsubscribe: (() => void) | null = null;
  #factory: PlayerRuntimeFactory | null = null;
  #ownsRuntime = false; // Track if we created the runtime (and should destroy it)

  constructor(videoElement?: HTMLVideoElement, playerRuntimeOrFactory?: PlayerRuntime | PlayerRuntimeFactory) {
    // Setup video element
    this.#videoElement = videoElement ?? document.createElement("video");

    // Initialize event listeners map
    this.#eventListeners = new Map([
      ["statechange", new Set()],
      ["timeupdate", new Set()],
      ["durationchange", new Set()],
      ["volumechange", new Set()],
      ["error", new Set()],
      ["ended", new Set()],
      ["fullscreenchange", new Set()],
    ]);

    // Handle PlayerRuntime or Factory
    if (playerRuntimeOrFactory) {
      if ("create" in playerRuntimeOrFactory) {
        // It's a factory - create our own runtime
        this.#factory = playerRuntimeOrFactory;
        this.#runtime = playerRuntimeOrFactory.create();
        this.#ownsRuntime = true;
        this.#runtime.mount(this.#videoElement)();
        this.#setupEventListeners();
      } else {
        // It's a PlayerRuntime instance - use it (shared)
        this.#runtime = playerRuntimeOrFactory;
        this.#ownsRuntime = false;
        this.#runtime.mount(this.#videoElement)();
        this.#setupEventListeners();
      }
    }
  }

  get videoElement(): HTMLVideoElement {
    return this.#videoElement;
  }

  /**
   * Returns the underlying PlayerRuntime instance.
   * This allows apps to integrate player UI components that need direct access to runtime state.
   */
  get playerRuntime(): PlayerRuntime | null {
    return this.#runtime;
  }

  /**
   * Sets the PlayerRuntime instance.
   * Called to inject a shared runtime (not owned by this service).
   */
  setPlayerRuntime =
    (runtime: PlayerRuntime): IO.IO<void> =>
    () => {
      // Cleanup old runtime if we own it
      if (this.#runtime && this.#ownsRuntime && this.#factory) {
        this.#cleanupEventListeners();
        this.#factory.destroy(this.#runtime);
      } else if (this.#runtime) {
        this.#cleanupEventListeners();
      }

      // Set new runtime (not owned by us)
      this.#runtime = runtime;
      this.#ownsRuntime = false;
      this.#factory = null;
      this.#runtime.mount(this.#videoElement)();
      this.#setupEventListeners();
    };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  loadSource =
    (source: VideoStreamSource): IO.IO<void> =>
    () => {
      if (!this.#runtime) {
        console.warn("PlayerRuntime not set, cannot load source");
        return;
      }

      // Apply source options directly to video element before load
      if (source.muted !== undefined) {
        this.#videoElement.muted = source.muted;
      }
      if (source.loop !== undefined) {
        this.#videoElement.loop = source.loop;
      }
      if (source.autoPlay !== undefined) {
        this.#videoElement.autoplay = source.autoPlay;
      }

      // Dispatch load to runtime
      this.#runtime.dispatch({
        _tag: "Intent/LoadRequested",
        url: source.url,
      })();

      // Handle auto-play by subscribing to playable state
      if (source.autoPlay) {
        const unsubscribe = this.#runtime.subscribeToState((state: PlayerState.Any) => {
          // Use matcher to detect when player is ready (paused and playable)
          if (Runtime.isPaused(state) && Runtime.isPlayable(state)) {
            this.#runtime!.dispatch({ _tag: "Intent/PlayRequested" })();
            unsubscribe();
          }
        });
      }
    };

  release = (): IO.IO<void> => () => {
    this.#cleanupEventListeners();
    if (this.#runtime) {
      // Only destroy if we own it (created via factory)
      if (this.#ownsRuntime && this.#factory) {
        this.#factory.destroy(this.#runtime);
      }
      this.#runtime = null;
    }
    this.#factory = null;
  };

  // ============================================================================
  // Playback Control
  // ============================================================================

  play = (): TE.TaskEither<Error, void> => async () => {
    if (!this.#runtime) {
      return { _tag: "Left", left: new Error("PlayerRuntime not set") } as const;
    }
    try {
      await this.#runtime.dispatch({
        _tag: "Intent/PlayRequested",
      })();
      return { _tag: "Right", right: undefined } as const;
    } catch (error) {
      return { _tag: "Left", left: error as Error } as const;
    }
  };

  pause = (): IO.IO<void> => () => {
    if (!this.#runtime) return;
    this.#runtime.dispatch({
      _tag: "Intent/PauseRequested",
    })();
  };

  stop = (): IO.IO<void> => () => {
    if (!this.#runtime) return;
    this.#runtime.dispatch({
      _tag: "Intent/PauseRequested",
    })();
    this.#runtime.dispatch({
      _tag: "Intent/SeekRequested",
      time: 0,
    })();
  };

  seek =
    (position: number): IO.IO<void> =>
    () => {
      if (!this.#runtime) return;
      // Position is in milliseconds, convert to seconds
      this.#runtime.dispatch({
        _tag: "Intent/SeekRequested",
        time: position / 1000,
      })();
    };

  // ============================================================================
  // Audio Control
  // ============================================================================

  setVolume =
    (volume: number): IO.IO<void> =>
    () => {
      if (!this.#runtime) return;
      // Volume is 0-100, convert to 0-1
      this.#runtime.dispatch({
        _tag: "Intent/SetVolumeRequested",
        volume: volume / 100,
      })();
    };

  setMuted =
    (muted: boolean): IO.IO<void> =>
    () => {
      if (!this.#runtime) return;
      this.#runtime.dispatch({
        _tag: "Intent/SetMutedRequested",
        muted,
      })();
    };

  // ============================================================================
  // Display Control
  // ============================================================================

  setFullscreen =
    (fullscreen: boolean): IO.IO<void> =>
    () =>
      fullscreen
        ? this.#videoElement.setAttribute("style", "width: 100%; height: 100%;")
        : this.#videoElement.removeAttribute("style");

  setSize =
    (width: number, height: number): IO.IO<void> =>
    () =>
      this.#videoElement.setAttribute("style", `width: ${width}px; height: ${height}px;`);

  // ============================================================================
  // Event Handling
  // ============================================================================

  on =
    <T extends VideoStreamEventType>(type: T, listener: VideoStreamEventListener<T>): IO.IO<void> =>
    () => {
      const listeners = this.#eventListeners.get(type);
      if (listeners) {
        listeners.add(listener as any);
      }
    };

  off =
    <T extends VideoStreamEventType>(type: T, listener: VideoStreamEventListener<T>): IO.IO<void> =>
    () => {
      const listeners = this.#eventListeners.get(type);
      if (listeners) {
        listeners.delete(listener as any);
      }
    };

  // ============================================================================
  // Private Methods
  // ============================================================================

  #setupEventListeners = (): void => {
    if (!this.#runtime) return;

    // Subscribe to runtime state changes
    this.#stateUnsubscribe = this.#runtime.subscribeToState((state: PlayerState.Any) => {
      const newPlayState = mapRuntimeStateToPlayState(state);
      const previousPlayState = this.#currentState;

      if (newPlayState !== previousPlayState) {
        this.#currentState = newPlayState;
        this.#emit("statechange", { state: newPlayState, previousState: previousPlayState });
      }

      // Use matchers to emit time updates for playable states
      if (Runtime.hasTimeInfo(state)) {
        const currentTime = Runtime.getCurrentTime(state);
        const duration = Runtime.getDuration(state);

        if (currentTime !== null) {
          this.#emit("timeupdate", { currentTime: Math.floor(currentTime * 1000) });
        }
        if (duration !== null) {
          this.#emit("durationchange", { duration: Math.floor(duration * 1000) });
        }
      }

      // Handle ended state and errors with match
      match(state)
        .when(Runtime.isEnded, () => {
          this.#emit("ended", {});
        })
        .when(Runtime.isError, (errorState) => {
          this.#emit("error", { error: createErrorFromRuntimeState(errorState) });
        })
        .otherwise(() => {});
    });

    // Subscribe to runtime events using match with type guards
    this.#eventsUnsubscribe = this.#runtime.subscribeToEvents((event: any) => {
      match(event)
        .when(Runtime.isVolumeChangeEvent, (e) => {
          this.#emit("volumechange", { volume: Math.round(e.volume * 100), muted: e.muted });
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

  #cleanupEventListeners = (): void => {
    if (this.#stateUnsubscribe) {
      this.#stateUnsubscribe();
      this.#stateUnsubscribe = null;
    }
    if (this.#eventsUnsubscribe) {
      this.#eventsUnsubscribe();
      this.#eventsUnsubscribe = null;
    }
  };

  #emit = <T extends VideoStreamEventType>(type: T, data: Omit<VideoStreamEvent<T>, "type" | "timestamp">): void => {
    const event = {
      type,
      timestamp: Date.now(),
      ...data,
    } as VideoStreamEvent<T>;

    const listeners = this.#eventListeners.get(type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in ${type} listener:`, error);
        }
      }
    }
  };
}
