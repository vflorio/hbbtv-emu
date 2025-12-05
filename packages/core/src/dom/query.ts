import type * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";

export const querySelector =
  (selector: string) =>
  (parent: ParentNode): IO.IO<O.Option<Element>> =>
  () =>
    O.fromNullable(parent.querySelector(selector));

export const querySelectorAs =
  <E extends Element>(selector: string) =>
  (parent: ParentNode): IO.IO<O.Option<E>> =>
  () =>
    O.fromNullable(parent.querySelector<E>(selector));

export const querySelectorAll =
  (selector: string) =>
  (parent: ParentNode): IO.IO<ReadonlyArray<Element>> =>
  () =>
    Array.from(parent.querySelectorAll(selector));

export const querySelectorAllAs =
  <E extends Element>(selector: string) =>
  (parent: ParentNode): IO.IO<ReadonlyArray<E>> =>
  () =>
    Array.from(parent.querySelectorAll<E>(selector));

export const getElementById =
  (id: string) =>
  (doc: Document): IO.IO<O.Option<HTMLElement>> =>
  () =>
    O.fromNullable(doc.getElementById(id));

export const getElementsByClassName =
  (className: string) =>
  (parent: Document | Element): IO.IO<ReadonlyArray<Element>> =>
  () =>
    Array.from(parent.getElementsByClassName(className));

export const getElementsByTagName =
  (tagName: string) =>
  (parent: Document | Element): IO.IO<ReadonlyArray<Element>> =>
  () =>
    Array.from(parent.getElementsByTagName(tagName));
