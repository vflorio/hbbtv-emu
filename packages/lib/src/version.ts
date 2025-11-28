import * as E from "fp-ts/Either";
import * as Eq from "fp-ts/Eq";
import { pipe } from "fp-ts/function";
import * as N from "fp-ts/number";
import * as Ord from "fp-ts/Ord";
import * as RA from "fp-ts/ReadonlyArray";
import * as S from "fp-ts/string";

export interface Version {
  readonly _tag: "Version";
  readonly parts: ReadonlyArray<number>;
}

export const parseVersion = (version: string): E.Either<string, Version> =>
  pipe(
    version,
    S.split("."),
    RA.traverse(E.Applicative)((part) => {
      const num = Number(part);
      return Number.isNaN(num) || num < 0 ? E.left(`Invalid version part: ${part}`) : E.right(num);
    }),
    E.map((parts) => ({ _tag: "Version" as const, parts })),
  );

export const unsafeParseVersion = (version: string): Version => {
  const result = parseVersion(version);
  if (E.isLeft(result)) {
    throw new Error(`Invalid version string: ${version}`);
  }
  return result.right;
};

export const eqVersion: Eq.Eq<Version> = Eq.struct({
  _tag: S.Eq,
  parts: RA.getEq(N.Eq),
});

export const ordVersion: Ord.Ord<Version> = pipe(
  RA.getOrd(N.Ord),
  Ord.contramap((v: Version) => v.parts),
);
