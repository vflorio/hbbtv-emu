import type * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";

export const getParentElement =
  (element: Element): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(element.parentElement);

export const getParentNode =
  (node: Node): IO.IO<O.Option<ParentNode>> =>
  () =>
    O.fromNullable(node.parentNode);

export const getChildren =
  (element: Element): IO.IO<ReadonlyArray<Element>> =>
  () =>
    Array.from(element.children);

export const getChildNodes =
  (node: Node): IO.IO<ReadonlyArray<ChildNode>> =>
  () =>
    Array.from(node.childNodes);

export const getFirstElementChild =
  (element: Element): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(element.firstElementChild);

export const getLastElementChild =
  (element: Element): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(element.lastElementChild);

export const getNextElementSibling =
  (element: Element): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(element.nextElementSibling);

export const getPreviousElementSibling =
  (element: Element): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(element.previousElementSibling);

export const closest =
  (selector: string) =>
  (element: Element): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(element.closest(selector));
