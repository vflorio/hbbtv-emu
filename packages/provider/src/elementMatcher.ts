import { type ClassType, createLogger, type DomObserver, type MutationHandler, querySelectorAll } from "@hbb-emu/core";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IORef from "fp-ts/IORef";
import * as NEA from "fp-ts/NonEmptyArray";
import * as O from "fp-ts/Option";

const logger = createLogger("ElementMatcher");

export interface ElementMatcher<E extends Element, T> {
  name: string;
  selector: string;
  predicate: (element: Element) => element is E;
  transform: (element: E) => T;
  onDetected: (item: T) => IO.IO<void>;
}

export interface ElementMatcherRegistry {
  matchersRef: IORef.IORef<ElementMatcher<any, any>[]>;
  registerMatcher: <E extends Element, T>(matcher: ElementMatcher<E, T>) => IO.IO<void>;
  initMatchers: IO.IO<void>;
}

export const WithElementMatcherRegistry = <T extends ClassType<DomObserver>>(Base: T) =>
  class extends Base implements ElementMatcherRegistry {
    matchersRef: IORef.IORef<ElementMatcher<any, any>[]> = IORef.newIORef<ElementMatcher<any, any>[]>([])();

    registerMatcher = <E extends Element, T>(matcher: ElementMatcher<E, T>): IO.IO<void> =>
      pipe(
        IO.Do,
        IO.flatMap(() =>
          pipe(
            this.matchersRef.read,
            IO.map((matchers) => [...matchers, matcher]),
            IO.flatMap((matchers) => this.matchersRef.write(matchers)),
          ),
        ),
        IO.flatMap(() => this.registerHandler(createMutationHandler(matcher))),
        IO.flatMap(() => processExistingElements(matcher)),
      );

    initMatchers: IO.IO<void> = this.startObserver;
  };

const extractAddedElements =
  (selector: string) =>
  (mutations: MutationRecord[]): Element[] =>
    pipe(
      mutations,
      A.flatMap((mutation) => Array.from(mutation.addedNodes)),
      A.filter((node): node is Element => node instanceof Element),
      A.flatMap((element) => [element, ...Array.from(element.querySelectorAll(selector))]),
    );

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
            logger.info(`${matcher.name} detected`),
            IO.flatMap(() => matcher.onDetected(item)),
          ),
        ),
      ),
      IO.asUnit,
    );

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
                logger.info(`existing ${matcher.name} found`),
                IO.flatMap(() => matcher.onDetected(item)),
              ),
            ),
            IO.map(() => undefined),
          ),
      ),
    ),
  );
