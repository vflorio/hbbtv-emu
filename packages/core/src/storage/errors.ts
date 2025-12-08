import type { JsonParseError, JsonStringifyError } from "../lib/json";
import type { DataNotFoundError, InvalidDataError } from "../misc";

// Errors

export type LocalStorageGetItemError = Readonly<{
  type: "LocalStorageGetItemError";
  message: string;
}>;

export type LocalStorageSetItemError = Readonly<{
  type: "LocalStorageSetItemError";
  message: string;
}>;

export const localStorageGetItemError = (message: string): LocalStorageGetItemError => ({
  type: "LocalStorageGetItemError",
  message,
});

export const localStorageSetItemError = (message: string): LocalStorageSetItemError => ({
  type: "LocalStorageSetItemError",
  message,
});

export type StorageError =
  | LocalStorageGetItemError
  | LocalStorageSetItemError
  | DataNotFoundError
  | InvalidDataError
  | JsonParseError
  | JsonStringifyError;
