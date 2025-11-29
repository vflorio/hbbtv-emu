import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import {
  type LocalStorageGetItemError,
  type LocalStorageSetItemError,
  localStorageGetItemError,
  localStorageSetItemError,
  type StorageAdapter,
} from "../..";
import { createLogger } from "../../logger";
import { type DataNotFoundError, dataNotFoundError } from "../../misc";

const logger = createLogger("LocalStorageAdapter");

export class LocalStorageAdapter implements StorageAdapter {
  getItem = (key: string): TE.TaskEither<LocalStorageGetItemError | DataNotFoundError, string> =>
    pipe(
      TE.tryCatch(
        () => Promise.resolve(localStorage.getItem(key)),
        (error): LocalStorageGetItemError => {
          logger.error("Failed to get item from localStorage:", error)();
          return localStorageGetItemError(`LocalStorage getItem failed: ${error}`);
        },
      ),
      TE.chainOptionK<LocalStorageGetItemError | DataNotFoundError>(() => dataNotFoundError("No data found"))(
        O.fromNullable,
      ),
    );

  setItem = (key: string, value: string): TE.TaskEither<LocalStorageSetItemError, void> =>
    TE.tryCatch(
      () => {
        localStorage.setItem(key, value);
        return Promise.resolve();
      },
      (error): LocalStorageSetItemError => {
        logger.error("Failed to set item in localStorage:", error)();
        return localStorageSetItemError(`LocalStorage setItem failed: ${error}`);
      },
    );
}
