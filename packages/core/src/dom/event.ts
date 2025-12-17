import type * as IO from "fp-ts/IO";

export type EventMapOf<T extends EventTarget> = T extends Window
  ? WindowEventMap
  : T extends Document
    ? DocumentEventMap
    : T extends HTMLMediaElement
      ? HTMLMediaElementEventMap
      : T extends HTMLElement
        ? HTMLElementEventMap
        : Record<string, Event>;

export const addEventListener =
  <Target extends EventTarget>(target: Target) =>
  <K extends Extract<keyof EventMapOf<Target>, string>>(type: K) =>
  (listener: (event: EventMapOf<Target>[K]) => void, options?: boolean | AddEventListenerOptions): IO.IO<void> =>
  () =>
    target.addEventListener(type, listener as unknown as EventListener, options);

export const addEventListenerIO =
  <Target extends EventTarget>(target: Target) =>
  <K extends Extract<keyof EventMapOf<Target>, string>>(type: K) =>
  (listener: (event: EventMapOf<Target>[K]) => IO.IO<void>, options?: boolean | AddEventListenerOptions): IO.IO<void> =>
  () =>
    target.addEventListener(type, (e) => listener(e as EventMapOf<Target>[K])(), options);

export const removeEventListener =
  <Target extends EventTarget>(target: Target) =>
  <K extends Extract<keyof EventMapOf<Target>, string>>(type: K) =>
  (listener: (event: EventMapOf<Target>[K]) => void, options?: boolean | EventListenerOptions): IO.IO<void> =>
  () =>
    target.removeEventListener(type, listener as unknown as EventListener, options);

export const dispatchEvent =
  <T>(type: string, detail?: T) =>
  (target: EventTarget): IO.IO<boolean> =>
  () =>
    target.dispatchEvent(new CustomEvent(type, { detail }));
