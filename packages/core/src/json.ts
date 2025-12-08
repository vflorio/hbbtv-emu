import * as E from "fp-ts/Either";

export type JsonParseError = Readonly<{
  type: "JsonParseError";
  message: string;
}>;

export const jsonParseError = (message: string): JsonParseError => ({
  type: "JsonParseError",
  message,
});

export const jsonParse = <T>(jsonString: string): E.Either<JsonParseError, T> =>
  E.tryCatch(
    () => JSON.parse(jsonString) as T,
    (error) => jsonParseError(`JSON parse error: ${error}`),
  );

export type JsonStringifyError = Readonly<{
  type: "JsonStringifyError";
  message: string;
}>;

export const jsonStringifyError = (message: string): JsonStringifyError => ({
  type: "JsonStringifyError",
  message,
});

export const jsonStringify = <T>(value: T): E.Either<JsonStringifyError, string> =>
  E.tryCatch(
    () => JSON.stringify(value),
    (error) => jsonStringifyError(`JSON stringify error: ${error}`),
  );
