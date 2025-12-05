import type * as IO from "fp-ts/IO";

export const addClass =
  (className: string) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.classList.add(className);

export const addClasses =
  (classNames: ReadonlyArray<string>) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.classList.add(...classNames);

export const removeClass =
  (className: string) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.classList.remove(className);

export const removeClasses =
  (classNames: ReadonlyArray<string>) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.classList.remove(...classNames);

export const toggleClass =
  (className: string) =>
  (element: Element): IO.IO<boolean> =>
  () =>
    element.classList.toggle(className);

export const hasClass =
  (className: string) =>
  (element: Element): IO.IO<boolean> =>
  () =>
    element.classList.contains(className);
