/**
 * OIPF intrinsic events and their corresponding DOM events.
 *
 * For each intrinsic event of an object (`onPlayStateChange`, …) "a corresponding DOM
 * event SHALL be generated" (OIPF DAE §7.13.1.4 for video/broadcast, §7.14.3.2 and
 * §7.14.9 for A/V Control): dispatched on the object itself, not bubbling, not
 * cancellable, with the event's context info as its properties (a `PlayStateChange`
 * of a video/broadcast has `state` and `error`). Applications listen to it with
 * `addEventListener()` on the object.
 *
 * Both come from one dispatch, as the browser does with its own `onxxx` handlers: the
 * `onXxx` property the application sets on the element is called by a listener added
 * when the object is bound, so before the application's own listeners. An exception
 * in one does not keep the others from running; the browser reports it. An event of
 * the same type the application dispatches itself does not call the property: it
 * has no arguments for it.
 *
 * Dispatched synchronously, as the intrinsic events were (OIPF does not say).
 */

/** A DOM event of an OIPF object, its context info as properties. */
export type IntrinsicEvent<Context extends object> = Event & Readonly<Context>;

/** A DOM event of type `type`, not bubbling, not cancellable, with `context` as its properties. */
export const createIntrinsicEvent = <Context extends object>(
  type: string,
  context: Context,
): IntrinsicEvent<Context> => {
  const event = new Event(type, { bubbles: false, cancelable: false });
  for (const [name, value] of Object.entries(context)) {
    Object.defineProperty(event, name, { value, enumerable: true });
  }
  return event as IntrinsicEvent<Context>;
};

/**
 * The intrinsic event `type` of the object bound to `target`. The function returned
 * fires it with the arguments of the `onXxx` property: the DOM event gets
 * `context(...args)` as its properties, and `callProperty(...args)` calls the property.
 */
export const intrinsicEvent = <Args extends ReadonlyArray<unknown>>(
  target: EventTarget,
  type: string,
  context: (...args: NoInfer<Args>) => object,
  callProperty: (...args: Args) => void,
): ((...args: Args) => void) => {
  const argumentsOf = new WeakMap<Event, Args>();
  target.addEventListener(type, (event) => {
    const args = argumentsOf.get(event);
    if (args !== undefined) callProperty(...args);
  });
  return (...args) => {
    const event = createIntrinsicEvent(type, context(...args));
    argumentsOf.set(event, args);
    target.dispatchEvent(event);
  };
};

/** No context info. */
export const noContext = (): object => ({});
