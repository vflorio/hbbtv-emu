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

type EventType<Target extends EventTarget> = Extract<keyof EventMapOf<Target>, string>;

type Listener<Target extends EventTarget, Type extends EventType<Target>> = (event: EventMapOf<Target>[Type]) => void;

export const addEventListener =
  <Target extends EventTarget>(target: Target) =>
  <Type extends EventType<Target>>(type: Type) =>
  (listener: Listener<Target, Type>, options?: boolean | AddEventListenerOptions): IO.IO<RemoveEventListenerFn> =>
  () => {
    target.addEventListener(type, listener as EventListener, options);
    return () => target.removeEventListener(type, listener as EventListener, options);
  };

export const removeEventListener =
  <Target extends EventTarget>(target: Target) =>
  <Type extends EventType<Target>>(type: Type) =>
  (listener: Listener<Target, Type>, options?: boolean | EventListenerOptions): RemoveEventListenerFn =>
  () =>
    target.removeEventListener(type, listener as EventListener, options);

export const dispatchEvent =
  <T>(type: string, detail?: T) =>
  (target: EventTarget): IO.IO<boolean> =>
  () =>
    target.dispatchEvent(new CustomEvent(type, { detail }));
