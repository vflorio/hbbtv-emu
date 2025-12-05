import type * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";

export const getAttribute =
  (name: string) =>
  (element: Element): IO.IO<O.Option<string>> =>
  () =>
    O.fromNullable(element.getAttribute(name));

export const setAttribute =
  (name: string) =>
  (value: string) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.setAttribute(name, value);

export const setAttributes =
  (attributes: Record<string, string>) =>
  (element: Element): IO.IO<void> =>
  () => {
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value);
    }
  };

export const removeAttribute =
  (name: string) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.removeAttribute(name);

export const hasAttribute =
  (name: string) =>
  (element: Element): IO.IO<boolean> =>
  () =>
    element.hasAttribute(name);

export const getDataAttribute =
  (name: string) =>
  (element: HTMLElement): IO.IO<O.Option<string>> =>
  () =>
    O.fromNullable(element.dataset[name]);

export const setDataAttribute =
  (name: string) =>
  (value: string) =>
  (element: HTMLElement): IO.IO<void> =>
  () => {
    element.dataset[name] = value;
  };
