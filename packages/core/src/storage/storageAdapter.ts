import type * as TE from "fp-ts/TaskEither";
import type { DataNotFoundError } from "../lib/misc";
import type { LocalStorageGetItemError, LocalStorageSetItemError } from "./errors";

export interface StorageAdapter {
  getItem(key: string): TE.TaskEither<LocalStorageGetItemError | DataNotFoundError, string>;
  setItem(key: string, value: string): TE.TaskEither<LocalStorageSetItemError, void>;
}
