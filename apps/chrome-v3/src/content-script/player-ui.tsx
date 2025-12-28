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
  show = (runtime: PlayerRuntime): IO.IO<void> =>
    pipe(
      logger.info("Showing Player UI overlay"),
      IO.flatMap(() => this.storeRuntime(runtime)),
      IO.flatMap(() => this.ensureContainer()),
      IO.flatMap(() => this.ensureRoot()),
      IO.flatMap(() => this.render()),
      IO.flatMap(() => logger.info("Player UI overlay shown")),
    );

  /**
   * Hides the Player UI overlay
   */
  hide = (): IO.IO<void> =>
    pipe(
      logger.info("Hiding Player UI overlay"),
      IO.flatMap(() => this.unmount()),
      IO.flatMap(() => this.removeContainer()),
      IO.flatMap(() => this.clearRuntime()),
      IO.flatMap(() => logger.info("Player UI overlay hidden")),
    );

  /**
   * Updates the runtime and re-renders
   */
  updateRuntime = (runtime: PlayerRuntime): IO.IO<void> =>
    pipe(
      logger.debug("Updating PlayerRuntime"),
      IO.flatMap(() => this.storeRuntime(runtime)),
      IO.flatMap(() => this.render()),
    );

  /**
   * Updates visibility based on flag
   */
  setVisible = (visible: boolean, runtime?: PlayerRuntime): IO.IO<void> =>
    pipe(
      O.Do,
      O.bind("runtime", () => O.fromNullable(runtime)),
      O.filter(() => visible),
      O.match(
        () =>
          pipe(
            O.of(visible),
            O.filter((v) => !v),
            O.match(
              () => IO.of(undefined),
              () => this.hide(),
            ),
          ),
        ({ runtime }) => this.show(runtime),
      ),
    );

  /**
   * Cleans up all resources
   */
  destroy = (): IO.IO<void> =>
    pipe(
      logger.debug("Destroying Player UI service"),
      IO.flatMap(() => this.unmount()),
      IO.flatMap(() => this.removeContainer()),
    );

  // ============================================================================
  // Private Methods - Pure Functional Helpers
  // ============================================================================

  /**
   * Ensure container element exists in DOM.
   * Pure functional pipeline that handles existing container.
   */
  private ensureContainer = (): IO.IO<void> =>
    pipe(
      this.#container,
      O.match(
        () =>
          pipe(
            IO.of(document.querySelector("[data-hbbtv-emu-container]")),
            IO.flatMap((videoContainer) =>
              pipe(
                O.fromNullable(videoContainer),
                O.match(
                  () => logger.warn("No HbbTV video container found"),
                  (parent) =>
                    pipe(
                      IO.of(this.createContainerElement()),
                      IO.flatMap((container) => () => {
                        parent.appendChild(container);
                        this.#container = O.some(container);
                        logger.debug("Created Player UI container")();
                      }),
                    ),
                ),
              ),
            ),
          ),
        () => IO.of(undefined),
      ),
    );

  /**
   * Create container DOM element with styles.
   * Pure function that returns new element.
   */
  private createContainerElement = (): HTMLDivElement => {
    const container = document.createElement("div");
    container.id = "hbbtv-player-ui-overlay";
    container.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 999999;
      pointer-events: none;
    `;
    return container;
  };

  /**
   * Remove container element from DOM.
   * Pure functional pipeline that handles missing container.
   */
  private removeContainer = (): IO.IO<void> =>
    pipe(
      this.#container,
      O.match(
        () => IO.of(undefined),
        (container) =>
          pipe(
            IO.of(container.remove()),
            IO.flatMap(() => logger.debug("Removed Player UI container")),
            IO.flatMap(() => () => {
              this.#container = O.none;
            }),
          ),
      ),
    );

  /**
   * Ensure React root exists for container.
   * Pure functional pipeline that handles existing root.
   */
  private ensureRoot = (): IO.IO<void> =>
    pipe(
      this.#root,
      O.match(
        () =>
          pipe(
            this.#container,
            O.match(
              () => IO.of(undefined),
              (container) =>
                pipe(
                  IO.of(createRoot(container)),
                  IO.flatMap((root) => () => {
                    this.#root = O.some(root);
                    logger.debug("Created React root")();
                  }),
                ),
            ),
          ),
        () => IO.of(undefined),
      ),
    );

  /**
   * Render Player UI component.
   * Pure functional pipeline that handles missing root or runtime.
   */
  private render = (): IO.IO<void> =>
    pipe(
      O.Do,
      O.bind("root", () => this.#root),
      O.bind("runtime", () => this.#runtime),
      O.match(
        () => IO.of(undefined),
        ({ root, runtime }) =>
          pipe(
            IO.of(root.render(<PlayerUIOverlay runtime={runtime} />)),
            IO.flatMap(() => logger.debug("Rendered Player UI overlay")),
          ),
      ),
    );

  /**
   * Unmount React root.
   * Pure functional pipeline that handles missing root.
   */
  private unmount = (): IO.IO<void> =>
    pipe(
      this.#root,
      O.match(
        () => IO.of(undefined),
        (root) =>
          pipe(
            IO.of(root.unmount()),
            IO.flatMap(() => logger.debug("Unmounted Player UI overlay")),
            IO.flatMap(() => () => {
              this.#root = O.none;
            }),
          ),
      ),
    );

  // ============================================================================
  // State Helpers
  // ============================================================================

  /**
   * Store runtime in local state.
   * Pure side effect wrapped in IO.
   */
  private storeRuntime =
    (runtime: PlayerRuntime): IO.IO<void> =>
    () => {
      this.#runtime = O.some(runtime);
    };

  /**
   * Clear runtime from local state.
   * Pure side effect wrapped in IO.
   */
  private clearRuntime = (): IO.IO<void> => () => {
    this.#runtime = O.none;
  };
}
