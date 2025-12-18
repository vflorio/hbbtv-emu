import {
  createLogger,
  createStatefulMethods,
  deriveSchema,
  type OnStateChangeCallback,
  type Stateful,
} from "@hbb-emu/core";
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
import type { VideoStreamEnv } from "../../subsystems/videoStream";
import { type PlayerError, PlayerPlayState, VideoStreamService } from "../../subsystems/videoStream";

const logger = createLogger("AVControlVideo");

// ─────────────────────────────────────────────────────────────────────────────
// A/V Control Video
// ─────────────────────────────────────────────────────────────────────────────

export class AVControlVideo implements OIPF.AV.Control.AVControlVideo, Stateful<AVControlState> {
  readonly #stream: VideoStreamService;

  // ═══════════════════════════════════════════════════════════════════════════
  // Stateful Interface
  // ═══════════════════════════════════════════════════════════════════════════

  readonly stateful = createStatefulMethods(
    deriveSchema<AVControlState, AVControlVideo>(AVControlStateCodec, {
      mappings: {
        mimeType: "_mimeType",
        data: "_data",
        playState: "_playState",
        error: "_error",
        playPosition: "_playPosition",
        playTime: "_playTime",
        speed: "_speed",
        volume: "_volume",
        muted: "_muted",
        width: "_width",
        height: "_height",
        fullScreen: "_fullScreen",
        components: "_components",
        selectedComponents: "_selectedComponents",
      },
    }),
    this,
  );

  applyState = (state: Partial<AVControlState>): IO.IO<void> => this.stateful.applyState(state);

  getState: IO.IO<Partial<AVControlState>> = this.stateful.getState;

  subscribe = (callback: OnStateChangeCallback<AVControlState>): IO.IO<() => void> => this.stateful.subscribe(callback);

  notifyStateChange = (changedKeys: ReadonlyArray<keyof AVControlState>): IO.IO<void> =>
    this.stateful.notifyStateChange(changedKeys);

  _mimeType = "";
  _data = DEFAULT_AV_CONTROL_DATA;
  _playState: OIPF.AV.Control.PlayState = DEFAULT_AV_CONTROL_PLAY_STATE;
  _error: OIPF.AV.Control.ErrorCode | undefined = undefined;
  _playPosition = 0;
  _playTime = 0;
  _speed = DEFAULT_AV_CONTROL_SPEED;
  _volume = 100;
  _muted = false;
  _width = String(DEFAULT_AV_CONTROL_WIDTH);
  _height = String(DEFAULT_AV_CONTROL_HEIGHT);
  _fullScreen = DEFAULT_AV_CONTROL_FULL_SCREEN;
  _components: unknown[] = [];
  _selectedComponents: Record<string, unknown> = {};

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

  constructor(env: AVControlVideoEnv) {
    this.#stream = new VideoStreamService(env.videoStream);

    this._mimeType = env.defaults.mimeType;
    this._data = env.defaults.data;
    this._playState = env.defaults.playState;
    this._speed = env.defaults.speed;
    this._volume = env.defaults.volume;
    this._muted = env.defaults.muted;
    this._width = env.defaults.width;
    this._height = env.defaults.height;
    this._fullScreen = env.defaults.fullScreen;

    this.setupBackendEventListeners();
    logger.info("Initialized")();
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Backend Event Integration
  // ═════════════════════════════════════════════════════════════════════════════

  setupBackendEventListeners = (): void => {
    this.#stream.on("statechange", (event) => {
      this.setPlayState(mapPlayerToAvControl(event.state));
    })();

    this.#stream.on("timeupdate", (event) => {
      this.onPlayPositionChanged?.(event.currentTime);
    })();

    this.#stream.on("fullscreenchange", (event) => {
      if (this._fullScreen !== event.fullscreen) {
        this._fullScreen = event.fullscreen;
        this.onFullScreenChange?.(event.fullscreen);
      }
    })();

    this.#stream.on("error", (event) => {
      this._error = this.mapErrorCode(event.error);
      this.setPlayState(OIPF.AV.Control.PlayState.ERROR);
    })();
  };

  mapErrorCode = (error: PlayerError): OIPF.AV.Control.ErrorCode => {
    switch (error.code) {
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

  get videoElement(): HTMLVideoElement {
    return this.#stream.videoElement;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Properties (readonly)
  // ═══════════════════════════════════════════════════════════════════════════

  get playPosition(): number | undefined {
    const time = this.videoElement.currentTime * 1000; // convert to ms
    return time > 0 ? time : undefined;
  }

  get playTime(): number | undefined {
    const duration = this.videoElement.duration * 1000; // convert to ms
    return duration > 0 && Number.isFinite(duration) ? duration : undefined;
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
          this.#stream.stop();
          this.setPlayState(OIPF.AV.Control.PlayState.STOPPED);
        }
        return IO.of(undefined);
      }),
      IO.tap(() =>
        IO.of(() => {
          this._data = url;
          if (url) {
            this.#stream.loadSource({ url, type: "video" })();
          } else {
            this.#stream.release();
            this.setPlayState(OIPF.AV.Control.PlayState.STOPPED);
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
        this.#stream.setSize(numericWidth, Number.parseInt(this._height, 10) || 0)();
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
        this.#stream.setSize(Number.parseInt(this._width, 10) || 0, numericHeight)();
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
          this.#stream.pause();
          this.setPlayState(OIPF.AV.Control.PlayState.PAUSED);
        } else {
          // Set connecting state before play attempt
          this.setPlayState(OIPF.AV.Control.PlayState.CONNECTING);
          this.#stream.play(speed)();
        }

        this.onPlaySpeedChanged?.(speed);
        return true;
      }),
    )();

  stop = (): boolean =>
    pipe(
      logger.debug("stop"),
      IO.map(() => {
        this.#stream.stop();
        this.setPlayState(OIPF.AV.Control.PlayState.STOPPED);
        return true;
      }),
    )();

  seek = (pos: number): boolean =>
    pipe(
      logger.debug("seek:", pos),
      IO.map(() => {
        const duration = this.videoElement.duration * 1000;
        if (pos >= 0 && pos <= duration) {
          this.#stream.seek(pos)();
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
        this._volume = volume;
        this.#stream.setVolume(volume)();
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
            this.#stream.setFullscreen(fullscreen)();
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
// State Mapping
// ─────────────────────────────────────────────────────────────────────────────

export type AVControlVideoDefaults = Readonly<{
  mimeType: string;
  data: string;
  playState: OIPF.AV.Control.PlayState;
  speed: number;
  volume: number;
  muted: boolean;
  width: string;
  height: string;
  fullScreen: boolean;
}>;

export type AVControlVideoEnv = Readonly<{
  videoStream: VideoStreamEnv;
  defaults: AVControlVideoDefaults;
}>;

export const DEFAULT_AV_CONTROL_VIDEO_DEFAULTS: AVControlVideoDefaults = {
  mimeType: "",
  data: DEFAULT_AV_CONTROL_DATA,
  playState: DEFAULT_AV_CONTROL_PLAY_STATE,
  speed: DEFAULT_AV_CONTROL_SPEED,
  volume: 100,
  muted: false,
  width: String(DEFAULT_AV_CONTROL_WIDTH),
  height: String(DEFAULT_AV_CONTROL_HEIGHT),
  fullScreen: DEFAULT_AV_CONTROL_FULL_SCREEN,
};

const mapPlayerToAvControl = (state: PlayerPlayState): OIPF.AV.Control.PlayState => {
  switch (state) {
    case PlayerPlayState.IDLE:
    case PlayerPlayState.STOPPED:
      return OIPF.AV.Control.PlayState.STOPPED;
    case PlayerPlayState.CONNECTING:
      return OIPF.AV.Control.PlayState.CONNECTING;
    case PlayerPlayState.BUFFERING:
      return OIPF.AV.Control.PlayState.BUFFERING;
    case PlayerPlayState.PLAYING:
      return OIPF.AV.Control.PlayState.PLAYING;
    case PlayerPlayState.PAUSED:
      return OIPF.AV.Control.PlayState.PAUSED;
    case PlayerPlayState.FINISHED:
      return OIPF.AV.Control.PlayState.FINISHED;
    case PlayerPlayState.ERROR:
      return OIPF.AV.Control.PlayState.ERROR;
  }
};
