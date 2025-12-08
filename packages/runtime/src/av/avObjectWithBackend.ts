/**
 * A/V Object Base with Video Backend
 *
 * Base class for A/V Control objects that uses the video-backend package
 * for unified player management.
 */

import { createLogger } from "@hbb-emu/core";
import {
  type AVControlState,
  AVControlStateCodec,
  DEFAULT_AV_CONTROL_DATA,
  DEFAULT_AV_CONTROL_FULL_SCREEN,
  DEFAULT_AV_CONTROL_HEIGHT,
  DEFAULT_AV_CONTROL_PLAY_STATE,
  DEFAULT_AV_CONTROL_SPEED,
  DEFAULT_AV_CONTROL_WIDTH,
  OIPF,
} from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import {
  createStatefulMethods,
  deriveSchema,
  type OnStateChangeCallback,
  type Stateful,
} from "../../../core/src/stateful";
import { UnifiedPlayState, WithVideoBackend } from "../providers/playback";

const logger = createLogger("AVObjectWithBackend");

// ─────────────────────────────────────────────────────────────────────────────
// State Mapping: Unified → AVControl
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map unified play state to AVControl PlayState.
 */
const mapUnifiedToAvControl = (state: UnifiedPlayState): OIPF.AV.control.PlayState => {
  switch (state) {
    case UnifiedPlayState.IDLE:
    case UnifiedPlayState.STOPPED:
      return OIPF.AV.control.PlayState.STOPPED;
    case UnifiedPlayState.CONNECTING:
      return OIPF.AV.control.PlayState.CONNECTING;
    case UnifiedPlayState.BUFFERING:
      return OIPF.AV.control.PlayState.BUFFERING;
    case UnifiedPlayState.PLAYING:
      return OIPF.AV.control.PlayState.PLAYING;
    case UnifiedPlayState.PAUSED:
      return OIPF.AV.control.PlayState.PAUSED;
    case UnifiedPlayState.FINISHED:
      return OIPF.AV.control.PlayState.FINISHED;
    case UnifiedPlayState.ERROR:
      return OIPF.AV.control.PlayState.ERROR;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Base Class for Mixin
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Empty base class for mixin composition.
 */
class EmptyBase {}

// ─────────────────────────────────────────────────────────────────────────────
// A/V Object Base with Video Backend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base class for A/V Control objects using the video backend.
 *
 * Provides:
 * - Unified player interface via WithVideoBackend mixin
 * - State mapping from unified states to AVControl.PlayState
 * - Full HbbTV A/V Control API compliance
 */
export class AVObjectWithBackend
  extends WithVideoBackend(EmptyBase)
  implements OIPF.AV.control.AVControlVideo, Stateful<AVControlState>
{
  // ═══════════════════════════════════════════════════════════════════════════
  // Stateful Interface
  // ═══════════════════════════════════════════════════════════════════════════

  readonly stateful = createStatefulMethods(
    deriveSchema<AVControlState, AVObjectWithBackend>(AVControlStateCodec),
    this,
  );

  applyState = (state: Partial<AVControlState>): IO.IO<void> => this.stateful.applyState(state);

  getState = (): IO.IO<Partial<AVControlState>> => this.stateful.getState();

  subscribe = (callback: OnStateChangeCallback<AVControlState>): IO.IO<() => void> => this.stateful.subscribe(callback);

  notifyStateChange = (changedKeys: ReadonlyArray<keyof AVControlState>): IO.IO<void> =>
    this.stateful.notifyStateChange(changedKeys);

  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  protected _data = DEFAULT_AV_CONTROL_DATA;
  protected _playState: OIPF.AV.control.PlayState = DEFAULT_AV_CONTROL_PLAY_STATE;
  protected _error: OIPF.AV.control.ErrorCode | undefined = undefined;
  protected _speed = DEFAULT_AV_CONTROL_SPEED;
  protected _width = String(DEFAULT_AV_CONTROL_WIDTH);
  protected _height = String(DEFAULT_AV_CONTROL_HEIGHT);
  protected _fullScreen = DEFAULT_AV_CONTROL_FULL_SCREEN;

  // ═══════════════════════════════════════════════════════════════════════════
  // Event Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  onPlayStateChange: OIPF.AV.control.OnPlayStateChangeHandler | null = null;
  onPlayPositionChanged: OIPF.AV.control.OnPlayPositionChangedHandler | null = null;
  onPlaySpeedChanged: OIPF.AV.control.OnPlaySpeedChangedHandler | null = null;
  onFullScreenChange: OIPF.AV.control.OnFullScreenChangeHandler | null = null;
  onfocus: (() => void) | null = null;
  onblur: (() => void) | null = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════════════

  constructor() {
    super();
    this.setupBackendEventListeners();
    logger.info("Initialized")();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Backend Event Integration
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Connect backend events to HbbTV API events.
   */
  setupBackendEventListeners = (): void => {
    // Map unified state changes to HbbTV playState
    this.onUnifiedStateChange((unifiedState) => {
      const avControlState = mapUnifiedToAvControl(unifiedState);
      this.setPlayState(avControlState);
    });

    // Map time updates
    this.onPlayerEvent("timeupdate", (event) => {
      this.onPlayPositionChanged?.(event.currentTime);
    });

    // Map errors
    this.onPlayerEvent("error", (event) => {
      this._error = this.mapErrorCode(event.error.code);
    });
  };

  /**
   * Map player error code to HbbTV error code.
   */
  mapErrorCode = (code: number): OIPF.AV.control.ErrorCode => {
    switch (code) {
      case 1: // MEDIA_ERR_ABORTED
        return OIPF.AV.control.ErrorCode.UNIDENTIFIED;
      case 2: // MEDIA_ERR_NETWORK
        return OIPF.AV.control.ErrorCode.CONNECTION_ERROR;
      case 3: // MEDIA_ERR_DECODE
        return OIPF.AV.control.ErrorCode.CONTENT_CORRUPT;
      case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
        return OIPF.AV.control.ErrorCode.FORMAT_NOT_SUPPORTED;
      default:
        return OIPF.AV.control.ErrorCode.UNIDENTIFIED;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Properties (readonly)
  // ═══════════════════════════════════════════════════════════════════════════

  get playPosition(): number | undefined {
    const time = this.player.currentTime;
    return time > 0 ? time : undefined;
  }

  get playTime(): number | undefined {
    const duration = this.player.duration;
    return duration > 0 ? duration : undefined;
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
          this.backendStop();
        }
        return IO.of(undefined);
      }),
      IO.tap(() =>
        IO.of(() => {
          this._data = url;
          if (url) {
            this.loadSource({ url })();
          } else {
            this.releasePlayer()();
          }
        }),
      ),
    )();
  }

  get width(): string {
    return this._width;
  }

  set width(value: string) {
    if (!this._fullScreen) {
      this._width = value;
      const numericWidth = Number.parseInt(value, 10);
      if (!Number.isNaN(numericWidth)) {
        this.backendSetSize(numericWidth, Number.parseInt(this._height, 10) || 0);
      }
    }
  }

  get height(): string {
    return this._height;
  }

  set height(value: string) {
    if (!this._fullScreen) {
      this._height = value;
      const numericHeight = Number.parseInt(value, 10);
      if (!Number.isNaN(numericHeight)) {
        this.backendSetSize(Number.parseInt(this._width, 10) || 0, numericHeight);
      }
    }
  }

  get fullScreen(): boolean {
    return this._fullScreen;
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

        if (speed === 0) {
          this.backendPause();
        } else {
          // Set connecting state before play attempt
          this.setPlayState(OIPF.AV.control.PlayState.CONNECTING);
          this.backendPlay(speed);
        }

        this.onPlaySpeedChanged?.(speed);
        return true;
      }),
    )();

  stop = (): boolean =>
    pipe(
      logger.debug("stop"),
      IO.map(() => {
        this.backendStop();
        return true;
      }),
    )();

  seek = (pos: number): boolean =>
    pipe(
      logger.debug("seek:", pos),
      IO.map(() => {
        const duration = this.player.duration;
        if (pos >= 0 && pos <= duration) {
          this.backendSeek(pos);
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
        this.backendSetVolume(volume);
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

  setFullScreen = (fullscreen: boolean): void => {
    pipe(
      logger.debug("setFullScreen:", fullscreen),
      IO.tap(() =>
        IO.of(() => {
          if (this._fullScreen !== fullscreen) {
            this._fullScreen = fullscreen;
            this.backendSetFullscreen(fullscreen);
            this.onFullScreenChange?.(fullscreen);
          }
        }),
      ),
    )();
  };

  focus = (): void => {
    pipe(
      logger.debug("focus"),
      IO.tap(() =>
        IO.of(() => {
          this.getVideoElement().focus();
          this.onfocus?.();
        }),
      ),
    )();
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
}
