import { type ClassType, createLogger } from "@hbb-emu/lib";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOO from "fp-ts/IOOption";
import * as IORef from "fp-ts/IORef";
import * as NEA from "fp-ts/NonEmptyArray";
import * as O from "fp-ts/Option";
import { querySelectorAll } from "fp-ts-std/DOM";
import type { DomObserver, MutationHandler } from "../../../lib/src/domObserver";

const logger = createLogger("ElementMatcher");

export interface ElementMatcher<E extends Element, T> {
  name: string;
  selector: string;
  predicate: (element: Element) => element is E;
  transform: (element: E) => T;
  onDetected: (item: T) => IO.IO<void>;
}

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
): IOO.IOOption<NEA.NonEmptyArray<T>> =>
  pipe(
    querySelectorAll(matcher.selector)(document),
    IOO.map(A.filter(matcher.predicate)),
    IOO.flatMap((elements) => pipe(elements, NEA.fromArray, IOO.fromOption)),
    IOO.map(NEA.map(matcher.transform)),
  );

const processExistingElements = <E extends Element, T>(matcher: ElementMatcher<E, T>): IO.IO<void> =>
  pipe(
    scanExistingElements(matcher),
    IOO.flatMap((items) =>
      pipe(
        items,
        A.traverse(IO.Applicative)((item) =>
          pipe(
            logger.info(`existing ${matcher.name} found`),
            IO.flatMap(() => matcher.onDetected(item)),
          ),
        ),
        IO.map(() => O.some(undefined)),
      ),
    ),
    IOO.getOrElse(() => IO.of(undefined)),
  );

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

    initMatchers: IO.IO<void> = pipe(
      logger.info("initializing element matchers"),
      IO.flatMap(() => this.startObserver),
    );
  };
