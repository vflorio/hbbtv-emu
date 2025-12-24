/**
 * Generic Event Bus for managing listeners and notifications
 */

import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as RA from "fp-ts/ReadonlyArray";
import type { UnsubscribeFn } from "./types";

export type Listener<T> = (data: T) => void;

/**
 * A generic event bus that manages a set of listeners and notifies them when data is published.
 */
export class EventBus<T> {
  private listeners = new Set<Listener<T>>();

  /**
   * Subscribe to events/state changes.
   * @param listener - The callback to be invoked when data is published
   * @param notifyImmediately - If true and initialValue is provided, notify the listener immediately
   * @param initialValue - Optional initial value to send to the listener
   * @returns An IO that returns an unsubscribe function
   */
  subscribe =
    (listener: Listener<T>, notifyImmediately = false, initialValue?: T): IO.IO<UnsubscribeFn> =>
    () => {
      this.listeners.add(listener);
      if (notifyImmediately && initialValue !== undefined) {
        listener(initialValue);
      }
      return () => this.listeners.delete(listener);
    };

  /**
   * Notify all listeners with the provided data.
   * @param data - The data to send to all listeners
   * @returns An IO that performs the notification
   */
  notify = (data: T): IO.IO<void> =>
    pipe(
      Array.from(this.listeners),
      RA.traverse(IO.Applicative)((listener) => IO.of(listener(data))),
      IO.map(() => undefined),
    );

  /**
   * Clear all listeners.
   */
  clear = (): IO.IO<void> => () => {
    this.listeners.clear();
  };

  /**
   * Get the current number of listeners.
   */
  size = (): number => this.listeners.size;
}
