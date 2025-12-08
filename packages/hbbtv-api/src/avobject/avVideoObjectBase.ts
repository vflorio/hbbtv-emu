import {
  type AVControlState,
  AVControlStateCodec,
  type Control,
  createLogger,
  DEFAULT_AV_CONTROL_FULL_SCREEN,
  DEFAULT_AV_CONTROL_HEIGHT,
  DEFAULT_AV_CONTROL_WIDTH,
} from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import { createBidirectionalMethods, deriveSchema, type OnStateChangeCallback, type Stateful } from "../stateful";
import { AVObjectBase } from "./avObjectBase";

const logger = createLogger("AVVideoBase");

// ─────────────────────────────────────────────────────────────────────────────
// A/V Video Object Base Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base class for video A/V Control objects.
 *
 * Extends AVObjectBase with functionality:
 * - Width/height properties
 * - Full screen support
 * - Focus/blur handlers
 */
export class AVVideoObjectBase extends AVObjectBase implements Control.AVControlVideo, Stateful<AVControlState> {
  // ═══════════════════════════════════════════════════════════════════════════
  // Stateful Interface
  // ═══════════════════════════════════════════════════════════════════════════

  readonly stateful = createBidirectionalMethods(
    deriveSchema<AVControlState, AVVideoObjectBase>(AVControlStateCodec),
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

  protected _width = String(DEFAULT_AV_CONTROL_WIDTH);
  protected _height = String(DEFAULT_AV_CONTROL_HEIGHT);
  protected _fullScreen = DEFAULT_AV_CONTROL_FULL_SCREEN;

  // ═══════════════════════════════════════════════════════════════════════════
  // Event Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  onFullScreenChange: Control.OnFullScreenChangeHandler | null = null;
  onfocus: (() => void) | null = null;
  onblur: (() => void) | null = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // Properties
  // ═══════════════════════════════════════════════════════════════════════════

  get width(): string {
    return this._width;
  }

  set width(value: string) {
    if (!this._fullScreen) {
      this._width = value;
      this.videoElement.style.width = value.includes("px") ? value : `${value}px`;
    }
  }

  get height(): string {
    return this._height;
  }

  set height(value: string) {
    if (!this._fullScreen) {
      this._height = value;
      this.videoElement.style.height = value.includes("px") ? value : `${value}px`;
    }
  }

  get fullScreen(): boolean {
    return this._fullScreen;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Methods
  // ═══════════════════════════════════════════════════════════════════════════

  setFullScreen = (fullscreen: boolean): void => {
    pipe(
      logger.debug("setFullScreen:", fullscreen),
      IO.tap(() =>
        IO.of(() => {
          if (this._fullScreen !== fullscreen) {
            this._fullScreen = fullscreen;

            if (fullscreen) {
              this.videoElement.requestFullscreen?.().catch((err) => {
                logger.warn("Fullscreen request failed:", err)();
              });
            } else {
              document.exitFullscreen?.().catch((err) => {
                logger.warn("Exit fullscreen failed:", err)();
              });
            }

            this.onFullScreenChange?.(fullscreen);
          }
        }),
      ),
    )();
  };

  focus = (): void => {
    pipe(
      logger.debug("focus"),
      IO.tap(() => IO.of(() => this.videoElement.focus())),
      IO.tap(() => IO.of(() => this.onfocus?.())),
    )();
  };
}
