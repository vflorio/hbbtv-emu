import * as E from "fp-ts/Either";

export const isServiceWorker = typeof self !== "undefined" && "ServiceWorkerGlobalScope" in self;

export const jsonParse = <T>(jsonString: string): E.Either<Error, T> =>
  E.tryCatch(
    () => JSON.parse(jsonString) as T,
    (error) => new Error(`JSON parse error: ${error}`),
  );

export const jsonStringify = <T>(value: T): E.Either<Error, string> =>
  E.tryCatch(
    () => JSON.stringify(value),
    (error) => new Error(`JSON stringify error: ${error}`),
  );

export interface Collection<T> {
  readonly length: number;
  item(index: number): T | null;
  [index: number]: T;
}

export const createEmptyCollection = <T>(): Collection<T> => ({
  length: 0,
  item: () => null,
});
