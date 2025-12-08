import { createLogger } from "@hbb-emu/core";
import { DEFAULT_AV_CONTROL_DATA, DEFAULT_AV_CONTROL_PLAY_STATE, DEFAULT_AV_CONTROL_SPEED, OIPF } from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";

const logger = createLogger("AVObjectBase");

// ─────────────────────────────────────────────────────────────────────────────
// A/V Object Base Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base class for all A/V Control objects (video/mp4, video/broadcast, DASH, etc.)
 *
 * Provides common playback functionality shared across all A/V objects:
 * - Playback state management
 * - Play/pause/stop/seek controls
 * - Volume control
 * - Event handlers
 * - Underlying HTMLVideoElement management
 */
export class AVObjectBase implements OIPF.AV.control.AVControlBase {
  /** The underlying HTML video element used for playback */
  protected videoElement: HTMLVideoElement = document.createElement("video");

  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  protected _data = DEFAULT_AV_CONTROL_DATA;
  protected _playState: OIPF.AV.control.PlayState = DEFAULT_AV_CONTROL_PLAY_STATE;
  protected _error: OIPF.AV.control.ErrorCode | undefined = undefined;
  protected _speed = DEFAULT_AV_CONTROL_SPEED;

  // ═══════════════════════════════════════════════════════════════════════════
  // Event Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  onPlayStateChange: OIPF.AV.control.OnPlayStateChangeHandler | null = null;
  onPlayPositionChanged: OIPF.AV.control.OnPlayPositionChangedHandler | null = null;
  onPlaySpeedChanged: OIPF.AV.control.OnPlaySpeedChangedHandler | null = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // Properties (readonly)
  // ═══════════════════════════════════════════════════════════════════════════

  get playPosition(): number | undefined {
    return pipe(
      O.fromNullable(this.videoElement.currentTime),
      O.map((t) => Math.floor(t * 1000)),
      O.toUndefined,
    );
  }

  get playTime(): number | undefined {
    return pipe(
      O.fromNullable(this.videoElement.duration),
      O.filter((d) => Number.isFinite(d)),
      O.map((d) => Math.floor(d * 1000)),
      O.toUndefined,
    );
  }

  get playState(): OIPF.AV.control.PlayState {
    return this._playState;
  }

  get error(): OIPF.AV.control.ErrorCode | undefined {
    return this._error;
  }

  get speed(): number {
    return this._speed;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Properties (read/write)
  // ═══════════════════════════════════════════════════════════════════════════

  get data(): string {
    return this._data;
  }

  set data(url: string) {
    pipe(
      logger.debug("Setting data:", url),
      IO.flatMap(() => {
        // Stop current playback if data changes
        if (this._data !== url && this._playState !== OIPF.AV.control.PlayState.STOPPED) {
          return IO.of(this.stop());
        }
        return IO.of(true);
      }),
      IO.tap(() =>
        IO.of(() => {
          this._data = url;
          if (url) {
            this.videoElement.src = url;
          } else {
            this.videoElement.removeAttribute("src");
            this.videoElement.load();
          }
        }),
      ),
    )();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Playback Methods
  // ═══════════════════════════════════════════════════════════════════════════

  play = (speed = 1): boolean =>
    pipe(
      logger.debug("play:", speed),
      IO.map(() => {
        if (!this._data) {
          return false;
        }

        this._speed = speed;
        this.videoElement.playbackRate = Math.abs(speed);

        if (speed === 0) {
          this.videoElement.pause();
          this.setPlayState(OIPF.AV.control.PlayState.PAUSED);
        } else {
          this.setPlayState(OIPF.AV.control.PlayState.CONNECTING);
          this.videoElement.play().then(
            () => this.setPlayState(OIPF.AV.control.PlayState.PLAYING),
            (err) => {
              logger.error("Playback error:", err)();
              this._error = OIPF.AV.control.ErrorCode.UNIDENTIFIED;
              this.setPlayState(OIPF.AV.control.PlayState.ERROR);
            },
          );
        }
        return true;
      }),
    )();

  stop = (): boolean =>
    pipe(
      logger.debug("stop"),
      IO.map(() => {
        this.videoElement.pause();
        this.videoElement.currentTime = 0;
        this.setPlayState(OIPF.AV.control.PlayState.STOPPED);
        return true;
      }),
    )();

  seek = (pos: number): boolean =>
    pipe(
      logger.debug("seek:", pos),
      IO.map(() => {
        const posSeconds = pos / 1000;
        if (posSeconds >= 0 && posSeconds <= (this.videoElement.duration || 0)) {
          this.videoElement.currentTime = posSeconds;
          this.onPlayPositionChanged?.(pos);
          return true;
        }
        return false;
      }),
    )();

  setVolume = (volume: number): boolean =>
    pipe(
      logger.debug("setVolume:", volume),
      IO.map(() => {
        const clampedVolume = Math.max(0, Math.min(100, volume));
        this.videoElement.volume = clampedVolume / 100;
        return true;
      }),
    )();

  queue = (_url: string | null): boolean => {
    logger.debug("queue: not implemented")();
    return false;
  };

  setSource = (_id: string): boolean => {
    logger.debug("setSource: not implemented")();
    return false;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Protected Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  protected setPlayState = (newState: OIPF.AV.control.PlayState): void => {
    if (this._playState !== newState) {
      const oldState = this._playState;
      this._playState = newState;
      logger.debug("PlayState changed:", oldState, "->", newState)();
      this.onPlayStateChange?.(newState);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Video Element Access (for subclasses)
  // ═══════════════════════════════════════════════════════════════════════════

  getVideoElement = (): HTMLVideoElement => this.videoElement;
}
