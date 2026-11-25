import * as O from "fp-ts/Option";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const sameValue = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * The smallest patch that turns `before` into `after`.
 *
 * Plain objects are compared key by key and only changed keys are kept; anything
 * else (arrays, primitives, class instances) is replaced as a whole when it differs.
 * Keys missing from `after` are ignored: a patch never deletes.
 * Returns `none` when nothing changed.
 */
export const diffPatch = (before: unknown, after: unknown): O.Option<unknown> => {
  if (!isPlainObject(before) || !isPlainObject(after)) {
    return sameValue(before, after) ? O.none : O.some(after);
  }

  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const changed = diffPatch(before[key], after[key]);
    if (O.isSome(changed)) patch[key] = changed.value;
  }
  return Object.keys(patch).length === 0 ? O.none : O.some(patch);
};
