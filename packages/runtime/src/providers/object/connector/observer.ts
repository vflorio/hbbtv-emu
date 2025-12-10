import { createLogger, querySelectorAll } from "@hbb-emu/core";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as NEA from "fp-ts/NonEmptyArray";
import * as O from "fp-ts/Option";
import type * as RIO from "fp-ts/ReaderIO";
import * as RA from "fp-ts/ReadonlyArray";
import type { ElementMatcher } from "./matcher";

export type ObserverEnv = Readonly<{
  observerRef: IORef.IORef<O.Option<MutationObserver>>;
  handlersRef: IORef.IORef<ReadonlyArray<MutationHandler>>;
  matchersRef: IORef.IORef<ReadonlyArray<ElementMatcher<any, any>>>;
}>;

export const createObserverEnv = (): ObserverEnv => ({
  observerRef: IORef.newIORef<O.Option<MutationObserver>>(O.none)(),
  handlersRef: IORef.newIORef<ReadonlyArray<MutationHandler>>([])(),
  matchersRef: IORef.newIORef<ReadonlyArray<ElementMatcher<any, any>>>([])(),
});

export type MutationHandler = (mutations: MutationRecord[]) => IO.IO<void>;

const logger = createLogger("Observer");

// Pure

const extractAddedElements =
  (selector: string) =>
  (mutations: MutationRecord[]): Element[] =>
    pipe(
      mutations,
      A.flatMap((mutation) => Array.from(mutation.addedNodes)),
      A.filter((node): node is Element => node instanceof Element),
      A.flatMap((element) => [element, ...Array.from(element.querySelectorAll(selector))]),
    );

// Operations

/** Register a mutation handler */
export const registerHandler =
  (handler: MutationHandler): RIO.ReaderIO<ObserverEnv, void> =>
  (env) =>
    pipe(
      env.handlersRef.read,
      IO.map((handlers) => [...handlers, handler]),
      IO.flatMap(env.handlersRef.write),
    );

/** Unregister a mutation handler */
export const unregisterHandler =
  (handler: MutationHandler): RIO.ReaderIO<ObserverEnv, void> =>
  (env) =>
    pipe(env.handlersRef.read, IO.map(RA.filter((h) => h !== handler)), IO.flatMap(env.handlersRef.write));

/** Execute all registered handlers for mutations */
const handleMutations =
  (mutations: MutationRecord[]): RIO.ReaderIO<ObserverEnv, void> =>
  (env) =>
    pipe(env.handlersRef.read, IO.flatMap(RA.traverse(IO.Applicative)((handler) => handler(mutations))), IO.asUnit);

// Matcher Operations

/** Create mutation handler for a matcher */
const createMutationHandler =
  <E extends Element, T>(matcher: ElementMatcher<E, T>): MutationHandler =>
  (mutations) =>
    pipe(
      IO.of(extractAddedElements(matcher.selector)(mutations)),
      IO.map(A.filter(matcher.predicate)),
      IO.map(A.map(matcher.transform)),
      IO.flatMap(
        A.traverse(IO.Applicative)((item) =>
          pipe(
            logger.debug(`${matcher.name} detected via mutation`),
            IO.flatMap(() => matcher.onDetected(item)),
          ),
        ),
      ),
      IO.asUnit,
    );

/** Scan document for existing elements matching the matcher */
const scanExistingElements = <E extends Element, T>(
  matcher: ElementMatcher<E, T>,
): IO.IO<O.Option<NEA.NonEmptyArray<T>>> =>
  pipe(
    querySelectorAll(matcher.selector)(document),
    IO.map((elements) => [...elements] as Element[]),
    IO.map(A.filter(matcher.predicate)),
    IO.map(NEA.fromArray),
    IO.map(O.map(NEA.map(matcher.transform))),
  );

/** Process existing elements for a matcher */
const processExistingElements = <E extends Element, T>(matcher: ElementMatcher<E, T>): IO.IO<void> =>
  pipe(
    scanExistingElements(matcher),
    IO.flatMap(
      O.match(
        () => IO.of(undefined),
        (items) =>
          pipe(
            items,
            A.traverse(IO.Applicative)((item) =>
              pipe(
                logger.debug(`existing ${matcher.name} found`),
                IO.flatMap(() => matcher.onDetected(item)),
              ),
            ),
            IO.map(() => undefined),
          ),
      ),
    ),
  );

/** Register a matcher (adds to registry, creates handler, processes existing) */
export const registerMatcher =
  <E extends Element, T>(matcher: ElementMatcher<E, T>): RIO.ReaderIO<ObserverEnv, void> =>
  (env) =>
    pipe(
      logger.debug("Registering matcher:", matcher.name),
      // Add to matchers registry
      IO.flatMap(() => env.matchersRef.read),
      IO.map((matchers) => [...matchers, matcher]),
      IO.flatMap(env.matchersRef.write),
      // Register mutation handler
      IO.flatMap(() => registerHandler(createMutationHandler(matcher))(env)),
      // Process existing elements
      IO.flatMap(() => processExistingElements(matcher)),
      IO.tap(() => logger.debug("Matcher registered:", matcher.name)),
    );

/** Register multiple matchers */
export const registerMatchers =
  (matchers: ReadonlyArray<ElementMatcher<any, any>>): RIO.ReaderIO<ObserverEnv, void> =>
  (env) =>
    pipe(
      matchers,
      RA.traverse(IO.Applicative)((matcher) => registerMatcher(matcher)(env)),
      IO.asUnit,
    );

// Observer Lifecycle

/** Start the DOM observer */
export const startObserver: RIO.ReaderIO<ObserverEnv, void> = (env) =>
  pipe(
    env.observerRef.read,
    IO.flatMap(
      O.match(
        () =>
          pipe(
            logger.info("Starting DOM observer"),
            IO.flatMap(() =>
              pipe(
                IO.of(new MutationObserver((mutations) => handleMutations(mutations)(env)())),
                IO.tap((observer) => () => {
                  observer.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                  });
                }),
                IO.flatMap((observer) => env.observerRef.write(O.some(observer))),
              ),
            ),
            IO.tap(() => logger.info("DOM observer started")),
          ),
        () => logger.debug("DOM observer already running"),
      ),
    ),
  );

/** Stop the DOM observer */
export const stopObserver: RIO.ReaderIO<ObserverEnv, void> = (env) =>
  pipe(
    env.observerRef.read,
    IO.flatMap(
      O.match(
        () => logger.debug("DOM observer not running"),
        (observer) =>
          pipe(
            logger.info("Stopping DOM observer"),
            IO.tap(() => () => observer.disconnect()),
            IO.flatMap(() => env.observerRef.write(O.none)),
            IO.tap(() => logger.info("DOM observer stopped")),
          ),
      ),
    ),
  );
