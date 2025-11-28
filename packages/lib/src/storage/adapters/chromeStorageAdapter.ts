import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../../logger";
import { type DataNotFoundError, dataNotFoundError } from "../../misc";
import {
  type LocalStorageGetItemError,
  type LocalStorageSetItemError,
  localStorageGetItemError,
  localStorageSetItemError,
} from "../errors";
import type { StorageAdapter } from "../storageAdapter";

const logger = createLogger("Chrome Storage");

export class ChromeStorageAdapter implements StorageAdapter {
  getItem = (key: string): TE.TaskEither<LocalStorageGetItemError | DataNotFoundError, string> =>
    pipe(
      TE.tryCatch(
        () => chrome.storage.local.get(key),
        (error): LocalStorageGetItemError => {
          logger.error("Failed to get item from chrome.storage:", error)();
          return localStorageGetItemError(`Chrome storage getItem failed: ${error}`);
        },
      ),
      TE.flatMapOption(
        (result) =>
          pipe(
            result[key],
            O.fromNullable,
            O.filter((value): value is string => typeof value === "string"),
          ),
        () => dataNotFoundError("No data found"),
      ),
    );

  setItem = (key: string, value: string): TE.TaskEither<LocalStorageSetItemError, void> =>
    TE.tryCatch(
      () => chrome.storage.local.set({ [key]: value }),
      (error): LocalStorageSetItemError => {
        logger.error("Failed to set item in chrome.storage:", error)();
        return localStorageSetItemError(`Chrome storage setItem failed: ${error}`);
      },
    );
}
