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

type RemoveEventListenerFn = IO.IO<void>;

export const addEventListener =
  <T extends EventTarget>(target: T) =>
  <K extends Extract<keyof EventMapOf<T>, string>>(type: K) =>
  (
    listener: (event: EventMapOf<T>[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): IO.IO<RemoveEventListenerFn> =>
  () => {
    target.addEventListener(type, listener as EventListener, options);
    return () => removeEventListener(target)(type)(listener, options);
  };

export const removeEventListener =
  <T extends EventTarget>(target: T) =>
  <K extends Extract<keyof EventMapOf<T>, string>>(type: K) =>
  (listener: (event: EventMapOf<T>[K]) => void, options?: boolean | EventListenerOptions): RemoveEventListenerFn =>
  () =>
    target.removeEventListener(type, listener as EventListener, options);

export const dispatchEvent =
  <T>(type: string, detail?: T) =>
  (target: EventTarget): IO.IO<boolean> =>
  () =>
    target.dispatchEvent(new CustomEvent(type, { detail }));
