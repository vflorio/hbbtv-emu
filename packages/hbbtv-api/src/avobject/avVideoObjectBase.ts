import { type Control, createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
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
export class AVVideoObjectBase extends AVObjectBase implements Control.AVControlVideo {
  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  protected _width = "0";
  protected _height = "0";
  protected _fullScreen = false;

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
