import type * as IO from "fp-ts/IO";

export const addEventListener =
  <K extends keyof HTMLElementEventMap>(type: K) =>
  (listener: (event: HTMLElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions) =>
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.addEventListener(type, listener, options);

export const addEventListenerIO =
  <K extends keyof HTMLElementEventMap>(type: K) =>
  (listener: (event: HTMLElementEventMap[K]) => IO.IO<void>, options?: boolean | AddEventListenerOptions) =>
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.addEventListener(type, (e) => listener(e)(), options);

export const addEventListenerGeneric =
  (type: string) =>
  (listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) =>
  (target: EventTarget): IO.IO<void> =>
  () =>
    target.addEventListener(type, listener, options);

export const addEventListenerGenericIO =
  (type: string) =>
  (listener: (event: Event) => IO.IO<void>, options?: boolean | AddEventListenerOptions) =>
  (target: EventTarget): IO.IO<void> =>
  () =>
    target.addEventListener(type, (e) => listener(e)(), options);

export const removeEventListener =
  <K extends keyof HTMLElementEventMap>(type: K) =>
  (listener: (event: HTMLElementEventMap[K]) => void, options?: boolean | EventListenerOptions) =>
  (element: HTMLElement): IO.IO<void> =>
  () =>
    element.removeEventListener(type, listener, options);

export const dispatchEvent =
  <T>(type: string, detail?: T) =>
  (target: EventTarget): IO.IO<boolean> =>
  () =>
    target.dispatchEvent(new CustomEvent(type, { detail }));
