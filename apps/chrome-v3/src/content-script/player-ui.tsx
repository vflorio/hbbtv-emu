import { createLogger } from "@hbb-emu/core";
import type { PlayerRuntime } from "@hbb-emu/player-runtime";
import { Overlay } from "@hbb-emu/player-ui";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import { createRoot, type Root } from "react-dom/client";

const logger = createLogger("ContentScript:PlayerUI");

/**
 * PlayerUI Component
 * Pure React component that displays player debug overlay
 */
interface PlayerUIOverlayProps {
  runtime: PlayerRuntime;
}

function PlayerUIOverlay({ runtime }: PlayerUIOverlayProps) {
  return <Overlay core={runtime} />;
}

/**
 * PlayerUI Service
 * Manages the lifecycle of the Player UI overlay
 */
export class PlayerUIService {
  #root: O.Option<Root> = O.none;
  #container: O.Option<HTMLDivElement> = O.none;
  #runtime: O.Option<PlayerRuntime> = O.none;

  /**
   * Shows the Player UI overlay
   * @param runtime - The PlayerRuntime instance to display
   */
  show =
    (runtime: PlayerRuntime): IO.IO<void> =>
    () => {
      logger.info("Showing Player UI overlay")();
      this.#runtime = O.some(runtime);
      this.#ensureContainer()();
      this.#ensureRoot()();
      this.#render()();
      logger.info("Player UI overlay shown")();
    };

  /**
   * Hides the Player UI overlay
   */
  hide = (): IO.IO<void> => () => {
    logger.info("Hiding Player UI overlay")();
    this.#unmount()();
    this.#removeContainer()();
    this.#runtime = O.none;
    logger.info("Player UI overlay hidden")();
  };

  /**
   * Updates the runtime and re-renders
   */
  updateRuntime =
    (runtime: PlayerRuntime): IO.IO<void> =>
    () => {
      logger.debug("Updating PlayerRuntime")();
      this.#runtime = O.some(runtime);
      this.#render()();
    };

  /**
   * Updates visibility based on flag
   */
  setVisible =
    (visible: boolean, runtime?: PlayerRuntime): IO.IO<void> =>
    () => {
      if (visible && runtime) {
        this.show(runtime)();
      } else if (!visible) {
        this.hide()();
      }
    };

  /**
   * Cleans up all resources
   */
  destroy = (): IO.IO<void> =>
    pipe(
      logger.debug("Destroying Player UI service"),
      IO.flatMap(() => this.#unmount()),
      IO.flatMap(() => this.#removeContainer()),
    );

  // ───────────────────────────────────────────────────────────────────────────
  // Private methods
  // ───────────────────────────────────────────────────────────────────────────

  #ensureContainer = (): IO.IO<void> => () => {
    if (O.isSome(this.#container)) {
      return;
    }

    // Find video container created by the provider
    const videoContainer = document.querySelector("[data-hbbtv-emu-container]");
    if (!videoContainer) {
      logger.warn("No HbbTV video container found")();
      return;
    }

    const container = document.createElement("div");
    container.id = "hbbtv-player-ui-overlay";
    container.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 999999;
      pointer-events: none;
    `;
    videoContainer.appendChild(container);
    this.#container = O.some(container);
    logger.debug("Created Player UI container")();
  };

  #removeContainer = (): IO.IO<void> => () => {
    pipe(
      this.#container,
      O.map((container) => {
        container.remove();
        logger.debug("Removed Player UI container")();
      }),
    );
    this.#container = O.none;
  };

  #ensureRoot = (): IO.IO<void> => () => {
    if (O.isSome(this.#root)) {
      return;
    }

    pipe(
      this.#container,
      O.map((container) => {
        const root = createRoot(container);
        this.#root = O.some(root);
        logger.debug("Created React root")();
      }),
    );
  };

  #render = (): IO.IO<void> => () => {
    pipe(
      this.#root,
      O.chain((root) =>
        pipe(
          this.#runtime,
          O.map((runtime) => {
            root.render(<PlayerUIOverlay runtime={runtime} />);
            logger.debug("Rendered Player UI overlay")();
            return root;
          }),
        ),
      ),
    );
  };

  #unmount = (): IO.IO<void> => () => {
    pipe(
      this.#root,
      O.map((root) => {
        root.unmount();
        logger.debug("Unmounted Player UI overlay")();
      }),
    );
    this.#root = O.none;
  };
}
