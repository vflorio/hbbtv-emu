import type * as IO from "fp-ts/IO";

export const setStyle =
  (property: string) =>
  (value: string) =>
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.style.setProperty(property, value);

export const setStyles =
  (styles: Record<string, string>) =>
  (element: HTMLElement): IO.IO<void> =>
  () => {
    for (const [key, value] of Object.entries(styles)) {
      element.style.setProperty(key, value);
    }
  };

export const getComputedStyle =
  (property: string) =>
  (element: Element): IO.IO<string> =>
  () =>
    window.getComputedStyle(element).getPropertyValue(property);

export const removeStyle =
  (property: string) =>
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.style.removeProperty(property);
