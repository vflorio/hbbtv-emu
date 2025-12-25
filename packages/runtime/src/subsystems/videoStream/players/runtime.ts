/**
 * PlayerRuntime adapter - bridges @hbb-emu/player-runtime with VideoStream interface
 */

import type { PlayerRuntime, PlayerState } from "@hbb-emu/player-runtime";
import type * as IO from "fp-ts/IO";
import type * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import type {
  Player,
  PlayerError,
  PlayerEvent,
  PlayerEventListener,
  PlayerEventType,
  PlayerSource,
  PlayerSourceType,
} from ".";
import { PlayerPlayState } from ".";

/**
 * Maps PlayerRuntime states to VideoStream PlayerPlayState
 */
const mapStateToPlayState = (state: PlayerState.Any): PlayerPlayState =>
  match(state)
    .with({ _tag: "Control/Idle" }, () => PlayerPlayState.IDLE)
    .with({ _tag: "Control/Loading" }, () => PlayerPlayState.CONNECTING)
    .with({ _tag: "Control/Playing" }, () => PlayerPlayState.PLAYING)
    .with({ _tag: "Control/Paused" }, () => PlayerPlayState.PAUSED)
    .with({ _tag: "Control/Buffering" }, () => PlayerPlayState.BUFFERING)
    .with({ _tag: "Control/Seeking" }, () => PlayerPlayState.BUFFERING)
    .with({ _tag: "Control/Ended" }, () => PlayerPlayState.FINISHED)
    .with({ isError: true }, () => PlayerPlayState.ERROR)
    .otherwise(() => PlayerPlayState.IDLE);

/**
 * Creates a PlayerError from PlayerRuntime error state
 */
const createPlayerErrorFromState = (state: PlayerState.Errors): PlayerError => ({
  code: match(state._tag)
    .with("Error/Network", () => 2)
    .with("Error/NotSupported", () => 4)
    .with("Error/DRM", () => 6)
    .otherwise(() => 1),
  message: state.error.message,
  details: state,
});

/**
 * Adapter that bridges PlayerRuntime with the VideoStream Player interface
 */
export class PlayerRuntimePlayer implements Player {
  readonly videoElement: HTMLVideoElement;
  readonly #runtime: PlayerRuntime;
  readonly #eventListeners: Map<PlayerEventType, Set<PlayerEventListener<any>>>;
  #currentState: PlayerPlayState = PlayerPlayState.IDLE;
  #sourceType: PlayerSourceType = "video";

  constructor(runtime: PlayerRuntime, videoElement: HTMLVideoElement, sourceType: PlayerSourceType = "video") {
    this.#runtime = runtime;
    this.videoElement = videoElement;
    this.#sourceType = sourceType;
    this.#eventListeners = new Map([
      ["statechange", new Set()],
      ["timeupdate", new Set()],
      ["durationchange", new Set()],
      ["volumechange", new Set()],
      ["error", new Set()],
      ["ended", new Set()],
      ["fullscreenchange", new Set()],
    ]);
  }

  get sourceType(): PlayerSourceType {
    return this.#sourceType;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  load =
    (source: PlayerSource): IO.IO<void> =>
    () => {
      // Update source type if provided
      if (source.type) {
        this.#sourceType = source.type;
      }

      // Dispatch load to runtime
      this.#runtime.dispatch({
        _tag: "Intent/LoadRequested",
        url: source.url,
      })();

      // Apply source options if needed
      if (source.muted !== undefined) {
        this.#runtime.dispatch({
          _tag: "Intent/SetMutedRequested",
          muted: source.muted,
        })();
      }

      if (source.autoPlay) {
        // Auto-play will happen when metadata is loaded (runtime transitions to Paused)
        // We can subscribe to state changes and trigger play
        const unsubscribe = this.#runtime.subscribeToState((state: PlayerState.Any) => {
          if (state._tag === "Control/Paused") {
            this.#runtime.dispatch({ _tag: "Intent/PlayRequested" })();
            unsubscribe();
          }
        });
      }
    };

  setupListeners = (): IO.IO<void> => () => {
    // Subscribe to runtime state changes
    this.#runtime.subscribeToState((state: PlayerState.Any) => {
      const newPlayState = mapStateToPlayState(state);
      const previousPlayState = this.#currentState;

      if (newPlayState !== previousPlayState) {
        this.#currentState = newPlayState;
        this.#emit("statechange", { state: newPlayState, previousState: previousPlayState });
      }

      // Handle specific events based on state
      match(state)
        .with({ _tag: "Control/Playing" }, (s) => {
          if ("currentTime" in s && "duration" in s) {
            this.#emit("timeupdate", { currentTime: Math.floor(s.currentTime * 1000) });
            this.#emit("durationchange", { duration: Math.floor(s.duration * 1000) });
          }
        })
        .with({ _tag: "Control/Paused" }, (s) => {
          if ("currentTime" in s && "duration" in s) {
            this.#emit("timeupdate", { currentTime: Math.floor(s.currentTime * 1000) });
            this.#emit("durationchange", { duration: Math.floor(s.duration * 1000) });
          }
        })
        .with({ _tag: "Control/Ended" }, () => {
          this.#emit("ended", {});
        })
        .with({ isError: true }, (s) => {
          this.#emit("error", { error: createPlayerErrorFromState(s as PlayerState.Errors) });
        })
        .otherwise(() => {});
    });

    // Subscribe to runtime events for additional info
    this.#runtime.subscribeToEvents((event: any) => {
      match(event)
        .with({ _tag: "Engine/VolumeChanged" }, (e: any) => {
          if ("volume" in e && "muted" in e) {
            this.#emit("volumechange", { volume: Math.round(e.volume * 100), muted: e.muted });
          }
        })
        .otherwise(() => {});
    });
  };

  release = (): IO.IO<void> => () => {
    // destroy is a TaskEither, we execute it but don't wait for result
    this.#runtime.destroy().catch(() => {});
  };

  // ============================================================================
  // Playback Control
  // ============================================================================

  play = (): TE.TaskEither<Error, void> => async () => {
    try {
      // dispatch returns Task<void>, we just await it
      await this.#runtime.dispatch({
        _tag: "Intent/PlayRequested",
      })();
      return { _tag: "Right", right: undefined } as const;
    } catch (error) {
      return { _tag: "Left", left: error as Error } as const;
    }
  };

  pause = (): IO.IO<void> => () => {
    this.#runtime.dispatch({
      _tag: "Intent/PauseRequested",
    })();
  };

  stop = (): IO.IO<void> => () => {
    // Stop is similar to pause + reset to beginning
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
      // Volume is 0-100, convert to 0-1
      this.#runtime.dispatch({
        _tag: "Intent/SetVolumeRequested",
        volume: volume / 100,
      })();
    };

  setMuted =
    (muted: boolean): IO.IO<void> =>
    () => {
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
    () => {
      if (fullscreen) {
        this.videoElement.requestFullscreen().catch(() => {});
      } else {
        if (document.fullscreenElement === this.videoElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

  setSize =
    (width: number, height: number): IO.IO<void> =>
    () => {
      this.videoElement.style.width = `${width}px`;
      this.videoElement.style.height = `${height}px`;
    };

  // ============================================================================
  // Event Handling
  // ============================================================================

  on =
    <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void> =>
    () => {
      const listeners = this.#eventListeners.get(type);
      if (listeners) {
        listeners.add(listener as any);
      }
    };

  off =
    <T extends PlayerEventType>(type: T, listener: PlayerEventListener<T>): IO.IO<void> =>
    () => {
      const listeners = this.#eventListeners.get(type);
      if (listeners) {
        listeners.delete(listener as any);
      }
    };

  // ============================================================================
  // Private Methods
  // ============================================================================

  #emit = <T extends PlayerEventType>(type: T, data: Omit<PlayerEvent<T>, "type" | "timestamp">): void => {
    const event = {
      type,
      timestamp: Date.now(),
      ...data,
    } as PlayerEvent<T>;

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
