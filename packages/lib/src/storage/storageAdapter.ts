import type * as TE from "fp-ts/TaskEither";
import type { DataNotFoundError } from "../misc";
import { ChromeStorageAdapter } from "./adapters/chromeStorageAdapter";
import { LocalStorageAdapter } from "./adapters/localStorageAdapter";
import type { LocalStorageGetItemError, LocalStorageSetItemError } from "./errors";

export interface StorageAdapter {
  getItem(key: string): TE.TaskEither<LocalStorageGetItemError | DataNotFoundError, string>;
  setItem(key: string, value: string): TE.TaskEither<LocalStorageSetItemError, void>;
}

export const createStorageAdapter = (): StorageAdapter =>
  typeof chrome !== "undefined" && chrome.storage?.local ? new ChromeStorageAdapter() : new LocalStorageAdapter();
