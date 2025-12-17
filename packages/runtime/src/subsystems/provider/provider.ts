import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { AnyOipfBinding, AnyStateful } from "./binding";
import type { DetectedElement } from "./detection";
import { applyAttachStrategy, createMatchers, DetectionObserver } from "./detection";
import type { ProviderEnv } from "./env";
import {
  applyExternalState,
  collectState,
  createStateChangeHandler,
  type GlobalState,
  InstanceRegistry,
} from "./registry";

const logger = createLogger("ProviderService");

// ─────────────────────────────────────────────────────────────────────────────
// Provider API
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderApi = Readonly<{
  /**
   * Starts the provider: begins observing DOM for OIPF elements.
   */
  start: () => IO.IO<void>;

  /**
   * Stops the provider: stops DOM observation.
   */
  stop: () => IO.IO<void>;

  /**
   * Applies external state to all managed instances.
   */
  applyState: (state: GlobalState) => IO.IO<void>;

  /**
   * Collects current state from all managed instances.
   */
  collectState: () => IO.IO<GlobalState>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Provider Service
// ─────────────────────────────────────────────────────────────────────────────

export class ProviderService implements ProviderApi {
  readonly #observer: DetectionObserver;
  readonly #registry: InstanceRegistry;
  readonly #env: ProviderEnv;

  constructor(env: ProviderEnv) {
    this.#env = env;
    this.#observer = new DetectionObserver();
    this.#registry = new InstanceRegistry();
  }

  /**
   * Initializes and starts the provider.
   */
  start = (): IO.IO<void> =>
    pipe(
      this.#initializeRegistry(),
      IO.flatMap(() => this.#registerMatchers()),
      IO.flatMap(() => this.#observer.start()),
      IO.tap(() => () => logger.info("Provider started")()),
    );

  /**
   * Stops the provider.
   */
  stop = (): IO.IO<void> =>
    pipe(
      this.#observer.stop(),
      IO.tap(() => () => logger.info("Provider stopped")()),
    );

  /**
   * Applies external state to all managed instances.
   */
  applyState = (state: GlobalState): IO.IO<void> => applyExternalState(this.#registry, state);

  /**
   * Collects current state from all managed instances.
   */
  collectState = (): IO.IO<GlobalState> => collectState(this.#registry);

  // ───────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ───────────────────────────────────────────────────────────────────────────

  #initializeRegistry = (): IO.IO<void> => this.#registry.initialize(this.#env.bindings);

  #registerMatchers = (): IO.IO<void> => () => {
    const matchers = createMatchers(this.#env.bindings, this.#handleDetection);

    for (const matcher of matchers) {
      this.#observer.registerMatcher(matcher)();
    }
  };

  #handleDetection = (binding: AnyOipfBinding, detected: DetectedElement): IO.IO<void> =>
    pipe(
      IO.of(binding.factory()),
      IO.tap((instance) => this.#registerInstance(binding, instance)),
      IO.tap((instance) => applyAttachStrategy(binding.connector.attachStrategy, detected, instance)),
      IO.map(() => undefined),
    );

  #registerInstance = (binding: AnyOipfBinding, instance: AnyStateful): IO.IO<void> => {
    const stateChangeHandler = createStateChangeHandler(this.#env.onStateChange ?? null);
    return this.#registry.addInstance(binding.stateful.stateKey, instance, stateChangeHandler);
  };
}
