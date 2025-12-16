import { createLogger } from "@hbb-emu/core";
import type * as IO from "fp-ts/IO";

const logger = createLogger("DetectionObserver");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detected element with metadata.
 */
export type DetectedElement = Readonly<{
  element: HTMLObjectElement;
  mimeType: string;
}>;

/**
 * Callback invoked when an element is detected.
 */
export type DetectionHandler = (detected: DetectedElement) => IO.IO<void>;

/**
 * Element matcher: combines selector, predicate, and handler.
 */
export type ElementMatcher = Readonly<{
  selector: string;
  predicate: (element: Element) => element is HTMLObjectElement;
  onDetected: DetectionHandler;
}>;

/**
 * Environment for the observer.
 */
export type ObserverEnv = Readonly<{
  matchers: ReadonlyArray<ElementMatcher>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Observer State
// ─────────────────────────────────────────────────────────────────────────────

type ObserverState = {
  observer: MutationObserver | null;
  processedElements: WeakSet<Element>;
};

const createObserverState = (): ObserverState => ({
  observer: null,
  processedElements: new WeakSet(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Observer Service
// ─────────────────────────────────────────────────────────────────────────────

export class DetectionObserver {
  readonly #state: ObserverState = createObserverState();
  readonly #matchers: ElementMatcher[] = [];

  /**
   * Registers a matcher and immediately scans existing elements.
   */
  registerMatcher =
    (matcher: ElementMatcher): IO.IO<void> =>
    () => {
      this.#matchers.push(matcher);
      this.#scanExistingElements(matcher)();
    };

  /**
   * Starts observing DOM mutations.
   */
  start = (): IO.IO<void> => () => {
    if (this.#state.observer) return;

    logger.debug("Starting DOM observer")();

    this.#state.observer = new MutationObserver((mutations) => {
      this.#handleMutations(mutations)();
    });

    this.#state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };

  /**
   * Stops observing DOM mutations.
   */
  stop = (): IO.IO<void> => () => {
    if (!this.#state.observer) return;

    logger.debug("Stopping DOM observer")();
    this.#state.observer.disconnect();
    this.#state.observer = null;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ───────────────────────────────────────────────────────────────────────────

  #scanExistingElements =
    (matcher: ElementMatcher): IO.IO<void> =>
    () => {
      const elements = Array.from(document.querySelectorAll(matcher.selector));
      for (const element of elements) {
        this.#processElement(element, matcher)();
      }
    };

  #handleMutations =
    (mutations: MutationRecord[]): IO.IO<void> =>
    () => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof Element) {
            this.#processNode(node)();
          }
        }
      }
    };

  #processNode =
    (node: Element): IO.IO<void> =>
    () => {
      for (const matcher of this.#matchers) {
        // Check the node itself
        this.#processElement(node, matcher)();

        // Check descendants
        const descendants = Array.from(node.querySelectorAll(matcher.selector));
        for (const descendant of descendants) {
          this.#processElement(descendant, matcher)();
        }
      }
    };

  #processElement =
    (element: Element, matcher: ElementMatcher): IO.IO<void> =>
    () => {
      if (this.#state.processedElements.has(element)) return;
      if (!matcher.predicate(element)) return;

      this.#state.processedElements.add(element);

      const detected: DetectedElement = {
        element,
        mimeType: element.getAttribute("type") ?? "",
      };

      matcher.onDetected(detected)();
    };
}
