/**
 * Composing an OIPF object from its Reader parts (ROADMAP D1).
 *
 * - `combine` gives one object with the members of all the parts' surfaces;
 * - `stateSchema` says how each key of the settings UI's state is read from, and
 *   applied to, the parts (their environments hold the state, not the object).
 */

import type { PropertyDescriptor } from "@hbb-emu/core";
import type * as IO from "fp-ts/IO";

type Intersection<T extends ReadonlyArray<object>> = T extends readonly [
  infer Head,
  ...infer Rest extends ReadonlyArray<object>,
]
  ? Head & Intersection<Rest>
  : unknown;

/** One object with the members of all `parts`, accessors included (a spread would read getters once). */
export const combine = <T extends ReadonlyArray<object>>(...parts: T): Intersection<T> =>
  Object.defineProperties(
    {},
    Object.assign({}, ...parts.map((part) => Object.getOwnPropertyDescriptors(part))),
  ) as Intersection<T>;

export type StateField = Readonly<{ read: IO.IO<unknown>; apply: (value: never) => IO.IO<void> }>;

/** How each key of the state `S` is read from, and applied to, the object's parts. */
export const stateSchema = <S extends object, T extends object>(
  fields: Readonly<Record<keyof S, StateField>>,
): ReadonlyArray<PropertyDescriptor<S, T>> =>
  (Object.keys(fields) as Array<keyof S>).map((stateKey) => ({
    stateKey,
    // Not an instance property: the parts' environments hold the state.
    instanceKey: stateKey as unknown as keyof T,
    apply: (_instance, value) => fields[stateKey].apply(value as never)(),
    read: () => fields[stateKey].read(),
  }));

/** A state key the settings UI only reads. */
export const readOnly = (read: IO.IO<unknown>): StateField => ({ read, apply: () => () => undefined });
