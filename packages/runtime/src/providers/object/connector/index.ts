import type * as IO from "fp-ts/IO";

export * from "./attach";
export * from "./detection";
export * from "./matcher";

/** Generic element matcher that transforms elements and handles detection */
export interface ElementMatcher<E extends Element, T> {
  readonly name: string;
  readonly selector: string;
  readonly predicate: (element: Element) => element is E;
  readonly transform: (element: E) => T;
  readonly onDetected: (item: T) => IO.IO<void>;
}

/** Type alias for HTMLObjectElement matchers (OIPF objects) */
export type OipfMatcher<T> = ElementMatcher<HTMLObjectElement, T>;
