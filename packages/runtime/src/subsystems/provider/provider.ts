import { createLogger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import type { AnyOipfBinding, AnyStateful, StateKey } from "./binding";
import type { DetectedElement } from "./detection";
import { applyAttachStrategy, createMatchers, DetectionObserver, detachAttachedElement } from "./detection";
import type { ProviderEnv } from "./env";
import {
  applyExternalState,
  collectState,
  createStateChangeHandler,
  type GlobalState,
  InstanceRegistry,
} from "./registry";

const logger = createLogger("Provider:Service");

// ─────────────────────────────────────────────────────────────────────────────
// Provider API
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderApi = Readonly<{
  /**
   * Starts the provider: begins observing DOM for OIPF elements.
   */
  start: IO.IO<void>;

  /**
   * Stops the provider: stops DOM observation.
   */
  stop: IO.IO<void>;

  /**
   * Applies external state to all managed instances.
   */
  applyState: (state: GlobalState) => IO.IO<void>;

  /**
   * Collects current state from all managed instances.
   */
  collectState: IO.IO<GlobalState>;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Provider Service
// ─────────────────────────────────────────────────────────────────────────────

export class ProviderService implements ProviderApi {
  readonly #observer: DetectionObserver;
  readonly #registry: InstanceRegistry;
  readonly #env: ProviderEnv;
  readonly #elementInstances: WeakMap<HTMLObjectElement, { stateKey: StateKey; instance: AnyStateful }> = new WeakMap();

  readonly #avControlIds: WeakMap<HTMLObjectElement, string> = new WeakMap();
  #avControlIdCounter = 0;

  constructor(env: ProviderEnv) {
    this.#env = env;
    this.#observer = new DetectionObserver();
    this.#registry = new InstanceRegistry();
  }

  /**
   * Initializes and starts the provider.
   */
  start: IO.IO<void> = () =>
    pipe(
      this.#initializeRegistry(),
      IO.flatMap(() => this.#registerMatchers()),
      IO.flatMap(() => this.#registerRemovalHandler()),
      IO.flatMap(() => this.#observer.start()),
      IO.tap(() => logger.info("Started")),
    )();

  /**
   * Stops the provider.
   */
  stop: IO.IO<void> = () =>
    pipe(
      this.#observer.stop(),
      IO.tap(() => logger.info("Stopped")),
    )();

  /**
   * Applies external state to all managed instances.
   */
  applyState =
    (state: GlobalState): IO.IO<void> =>
    () => {
      // Generic state: apply slice to all instances of that key.
      // Special-case avControls: external shape is a record keyed by object id.
      const entries = Object.entries(state);
      const genericStateEntries = entries.filter(([key]) => key !== "avControls");
      const genericState = Object.fromEntries(genericStateEntries) as GlobalState;

      applyExternalState(this.#registry, genericState)();
      this.#applyAvControlsState((state as Partial<Record<StateKey, unknown>>).avControls)();
    };

  /**
   * Collects current state from all managed instances.
   */
  collectState: IO.IO<GlobalState> = () => {
    const base = collectState(this.#registry)();
    const avControls = this.#collectAvControlsState()();

    if (Object.keys(avControls).length === 0) return base;
    return {
      ...base,
      avControls,
    };
  };

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

  #registerRemovalHandler = (): IO.IO<void> => this.#observer.registerRemovalHandler(this.#handleRemoval);

  #handleDetection = (binding: AnyOipfBinding, detected: DetectedElement): IO.IO<void> =>
    pipe(
      IO.of(binding.factory()),
      IO.tap((instance) => () => {
        this.#elementInstances.set(detected.element, { stateKey: binding.name, instance });
      }),
      IO.tap((instance) => this.#registerInstance(binding, instance)),
      IO.tap((instance) => applyAttachStrategy(binding.connector.attachStrategy, detected, instance)),
      IO.map(() => undefined),
    );

  #handleRemoval = (element: HTMLObjectElement): IO.IO<void> =>
    pipe(
      IO.of(this.#elementInstances.get(element)),
      IO.tap(() => detachAttachedElement(element)),
      IO.tap((entry) => () => {
        if (!entry) return;
        this.#registry.removeInstance(entry.stateKey, entry.instance)();
        this.#elementInstances.delete(element);
        this.#avControlIds.delete(element);
      }),
      IO.map(() => undefined),
    );

  #registerInstance = (binding: AnyOipfBinding, instance: AnyStateful): IO.IO<void> => {
    const stateChangeHandler = createStateChangeHandler(this.#env.onStateChange ?? null);
    return this.#registry.addInstance(binding.name, instance, stateChangeHandler);
  };

  #getAvControlKeyForElement = (element: HTMLObjectElement): string => {
    const existing = this.#avControlIds.get(element);
    if (existing) return existing;

    const id = element.id?.trim();
    const key = id && id.length > 0 ? id : `__avc_${++this.#avControlIdCounter}`;
    this.#avControlIds.set(element, key);
    return key;
  };

  #applyAvControlsState =
    (stateSlice: unknown): IO.IO<void> =>
    () => {
      if (!stateSlice || typeof stateSlice !== "object") return;

      const record = stateSlice as Record<string, unknown>;

      for (const [element, entry] of this.#elementInstancesEntries()) {
        if (entry.stateKey !== "avControls") continue;

        const key = this.#getAvControlKeyForElement(element);
        const perInstanceState = record[key];
        if (!perInstanceState || typeof perInstanceState !== "object") continue;

        entry.instance.applyState(perInstanceState as Partial<unknown>)();
      }
    };

  #collectAvControlsState = (): IO.IO<Record<string, unknown>> => () => {
    const result: Record<string, unknown> = {};

    for (const [element, entry] of this.#elementInstancesEntries()) {
      if (entry.stateKey !== "avControls") continue;

      const key = this.#getAvControlKeyForElement(element);
      result[key] = entry.instance.getState();
    }

    return result;
  };

  // WeakMap is not iterable; we keep a small helper to access its current content
  // by tracking elements via the observer lifecycle.
  #elementInstancesEntries = (): ReadonlyArray<[HTMLObjectElement, { stateKey: StateKey; instance: AnyStateful }]> => {
    const entries: Array<[HTMLObjectElement, { stateKey: StateKey; instance: AnyStateful }]> = [];

    // We can't iterate WeakMap, so we discover elements via the DOM.
    // This stays bounded because it only queries existing <object> tags.
    for (const el of Array.from(document.querySelectorAll("object"))) {
      if (!(el instanceof HTMLObjectElement)) continue;
      const entry = this.#elementInstances.get(el);
      if (!entry) continue;
      entries.push([el, entry]);
    }

    return entries;
  };
}

export const createProviderService = (env: ProviderEnv): ProviderService => new ProviderService(env);
