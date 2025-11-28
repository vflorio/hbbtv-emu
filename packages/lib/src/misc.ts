import * as E from "fp-ts/Either";

export const isServiceWorker = typeof self !== "undefined" && "ServiceWorkerGlobalScope" in self;

export const parseJson = <T>(jsonString: string): E.Either<Error, T> =>
  E.tryCatch(
    () => JSON.parse(jsonString) as T,
    (error) => new Error(`JSON parse error: ${error}`),
  );

export const stringifyJson = <T>(value: T): E.Either<Error, string> =>
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

export const tryCatch = async (
  callback: () => Promise<void>,
  [matchError, message]: [(error: Error) => boolean, string],
  logger: typeof console = console,
) => {
  try {
    await callback();
  } catch (error) {
    if (error instanceof Error && matchError(error)) {
      logger.error(message);
      return;
    }
    logger.error("Unknown error", error);
    throw error;
  }
};
