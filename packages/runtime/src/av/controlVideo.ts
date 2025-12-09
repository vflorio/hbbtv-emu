/**
 * A/V Control Video
 *
 * Base class for A/V Control video objects that uses ObjectVideoStream
 * for stream player management.
 */

import {
  createLogger,
  createStatefulMethods,
  deriveSchema,
  type OnStateChangeCallback,
  type Stateful,
} from "@hbb-emu/core";
import {
  AV_CONTROL_DASH_MIME_TYPE,
  AV_CONTROL_VIDEO_MP4_MIME_TYPE,
  type AVControlState,
  AVControlStateCodec,
  DEFAULT_AV_CONTROL_DATA,
  DEFAULT_AV_CONTROL_FULL_SCREEN,
  DEFAULT_AV_CONTROL_HEIGHT,
  DEFAULT_AV_CONTROL_PLAY_STATE,
  DEFAULT_AV_CONTROL_SPEED,
  DEFAULT_AV_CONTROL_WIDTH,
  isValidAvControlDash,
  isValidAvControlVideoMp4,
  OIPF,
} from "@hbb-emu/oipf";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { StreamPlayState } from "../providers/videoStream";
import { ObjectVideoStream } from "../providers/videoStream/objectVideoStream";
import type { ObjectDefinition } from "../types";

const logger = createLogger("AVControlVideo");

export const avVideoMp4Definition: ObjectDefinition<AVControlVideo, AVControlState, "avControls"> = {
  name: "AvVideoMp4",
  selector: `object[type="${AV_CONTROL_VIDEO_MP4_MIME_TYPE}"]`,
  predicate: isValidAvControlVideoMp4,
  factory: () => new AVControlVideo(),
  stateKey: "avControls",
  attachStrategy: "proxy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

/**
 * AvVideoDash definition.
 */
export const avVideoDashDefinition: ObjectDefinition<AVControlVideo, AVControlState, "avControls"> = {
  name: "AvVideoDash",
  selector: `object[type="${AV_CONTROL_DASH_MIME_TYPE}"]`,
  predicate: isValidAvControlDash,
  factory: () => new AVControlVideo(),
  stateKey: "avControls",
  attachStrategy: "proxy",
  applyState: (instance, state) => instance.applyState(state ?? {}),
  getState: (instance) => instance.getState(),
  subscribe: (instance, callback) => instance.subscribe(callback),
};

// ─────────────────────────────────────────────────────────────────────────────
// A/V Control Video
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A/V Control Video implementation using ObjectVideoStream.
 *
 * Provides:
 * - Stream player interface via ObjectVideoStream
 * - State mapping from stream states to AVControl.PlayState
 * - Full HbbTV A/V Control API compliance
 *
 * Use this class for video/mp4, video/mpeg and similar MIME types.
 */
export class AVControlVideo
  extends ObjectVideoStream
  implements OIPF.AV.Control.AVControlVideo, Stateful<AVControlState>
{
  // ═══════════════════════════════════════════════════════════════════════════
  // Stateful Interface
  // ═══════════════════════════════════════════════════════════════════════════

  readonly stateful = createStatefulMethods(deriveSchema<AVControlState, AVControlVideo>(AVControlStateCodec), this);

  applyState = (state: Partial<AVControlState>): IO.IO<void> => this.stateful.applyState(state);

  getState = (): IO.IO<Partial<AVControlState>> => this.stateful.getState();

  subscribe = (callback: OnStateChangeCallback<AVControlState>): IO.IO<() => void> => this.stateful.subscribe(callback);

  notifyStateChange = (changedKeys: ReadonlyArray<keyof AVControlState>): IO.IO<void> =>
    this.stateful.notifyStateChange(changedKeys);

  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  protected _data = DEFAULT_AV_CONTROL_DATA;
  protected _playState: OIPF.AV.Control.PlayState = DEFAULT_AV_CONTROL_PLAY_STATE;
  protected _error: OIPF.AV.Control.ErrorCode | undefined = undefined;
  protected _speed = DEFAULT_AV_CONTROL_SPEED;
  protected _width = String(DEFAULT_AV_CONTROL_WIDTH);
  protected _height = String(DEFAULT_AV_CONTROL_HEIGHT);
  protected _fullScreen = DEFAULT_AV_CONTROL_FULL_SCREEN;

  // ═══════════════════════════════════════════════════════════════════════════
  // Event Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  onPlayStateChange: OIPF.AV.Control.OnPlayStateChangeHandler | null = null;
  onPlayPositionChanged: OIPF.AV.Control.OnPlayPositionChangedHandler | null = null;
  onPlaySpeedChanged: OIPF.AV.Control.OnPlaySpeedChangedHandler | null = null;
  onFullScreenChange: OIPF.AV.Control.OnFullScreenChangeHandler | null = null;
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
    // Map stream state changes to HbbTV playState
    this.onStreamStateChange((streamState) => {
      const avControlState = mapStreamToAvControl(streamState);
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
  mapErrorCode = (code: number): OIPF.AV.Control.ErrorCode => {
    switch (code) {
      case 1: // MEDIA_ERR_ABORTED
        return OIPF.AV.Control.ErrorCode.UNIDENTIFIED;
      case 2: // MEDIA_ERR_NETWORK
        return OIPF.AV.Control.ErrorCode.CONNECTION_ERROR;
      case 3: // MEDIA_ERR_DECODE
        return OIPF.AV.Control.ErrorCode.CONTENT_CORRUPT;
      case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
        return OIPF.AV.Control.ErrorCode.FORMAT_NOT_SUPPORTED;
      default:
        return OIPF.AV.Control.ErrorCode.UNIDENTIFIED;
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

  get playState(): OIPF.AV.Control.PlayState {
    return this._playState;
  }

  get error(): OIPF.AV.Control.ErrorCode | undefined {
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
        if (this._data !== url && this._playState !== OIPF.AV.Control.PlayState.STOPPED) {
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
          this.setPlayState(OIPF.AV.Control.PlayState.CONNECTING);
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
          this.videoElement.focus();
          this.onfocus?.();
        }),
      ),
    )();
  };

  protected setPlayState = (newState: OIPF.AV.Control.PlayState): void => {
    if (this._playState !== newState) {
      const oldState = this._playState;
      this._playState = newState;
      logger.debug("PlayState changed:", oldState, "->", newState)();
      this.onPlayStateChange?.(newState);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// State Mapping: Stream → AVControl
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map stream play state to AVControl PlayState.
 */
const mapStreamToAvControl = (state: StreamPlayState): OIPF.AV.Control.PlayState => {
  switch (state) {
    case StreamPlayState.IDLE:
    case StreamPlayState.STOPPED:
      return OIPF.AV.Control.PlayState.STOPPED;
    case StreamPlayState.CONNECTING:
      return OIPF.AV.Control.PlayState.CONNECTING;
    case StreamPlayState.BUFFERING:
      return OIPF.AV.Control.PlayState.BUFFERING;
    case StreamPlayState.PLAYING:
      return OIPF.AV.Control.PlayState.PLAYING;
    case StreamPlayState.PAUSED:
      return OIPF.AV.Control.PlayState.PAUSED;
    case StreamPlayState.FINISHED:
      return OIPF.AV.Control.PlayState.FINISHED;
    case StreamPlayState.ERROR:
      return OIPF.AV.Control.PlayState.ERROR;
  }
};
