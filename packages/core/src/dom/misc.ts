import type * as IO from "fp-ts/IO";

// Focus

export const focus =
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.focus();

export const blur =
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.blur();

// Scroll

export const scrollIntoView =
  (options?: ScrollIntoViewOptions) =>
  (element: Element): IO.IO<void> =>
  () =>
    element.scrollIntoView(options);

// Dimensions

export const getBoundingClientRect =
  (element: Element): IO.IO<DOMRect> =>
  () =>
    element.getBoundingClientRect();

export const getOffsetDimensions =
  (element: HTMLElement): IO.IO<{ width: number; height: number; top: number; left: number }> =>
  () => ({
    width: element.offsetWidth,
    height: element.offsetHeight,
    top: element.offsetTop,
    left: element.offsetLeft,
  });
