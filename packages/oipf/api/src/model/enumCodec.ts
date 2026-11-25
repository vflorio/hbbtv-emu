/**
 * Codecs for the spec's numeric enums. The enum in `specification/` is the only list
 * of the values, so the state codecs cannot drift from it (they did, when written by
 * hand: `ID_DVB_T = 2` instead of 12).
 */

import * as t from "io-ts";

/**
 * The enum's values as number literals (`0 | 10 | 12 | …`): unlike the enum type, it
 * can be named by packages that only see this one's declarations.
 */
export type EnumValue<E extends number> = `${E}` extends `${infer N extends number}` ? N : never;

/** Accepts exactly the numeric values of `enumObject`. */
export const enumCodec = <E extends number>(
  name: string,
  enumObject: Readonly<Record<string, string | number>>,
): t.Type<EnumValue<E>, EnumValue<E>, unknown> => {
  const values = new Set(Object.values(enumObject).filter((value): value is number => typeof value === "number"));
  const is = (input: unknown): input is EnumValue<E> => typeof input === "number" && values.has(input);
  return new t.Type<EnumValue<E>, EnumValue<E>, unknown>(
    name,
    is,
    (input, context) => (is(input) ? t.success(input) : t.failure(input, context)),
    t.identity,
  );
};
