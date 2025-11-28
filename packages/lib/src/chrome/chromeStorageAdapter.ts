import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { createLogger } from "../misc";
import type { StorageAdapter } from "../storage";

const logger = createLogger("Chrome Storage");

export class ChromeStorageAdapter implements StorageAdapter {
  getItem = (key: string): TE.TaskEither<Error, string> =>
    pipe(
      TE.tryCatch(
        () => chrome.storage.local.get(key),
        (error): Error => {
          logger.error("Failed to get item from chrome.storage:", error);
          return new Error(`Chrome storage getItem failed: ${error}`);
        },
      ),
      TE.chainOptionK(() => new Error("No data found"))((result) =>
        pipe(
          result[key],
          O.fromNullable,
          O.filter((value): value is string => typeof value === "string"),
        ),
      ),
    );

  setItem = (key: string, value: string): TE.TaskEither<Error, void> =>
    TE.tryCatch(
      () => chrome.storage.local.set({ [key]: value }),
      (error): Error => {
        logger.error("Failed to set item in chrome.storage:", error);
        return new Error(`Chrome storage setItem failed: ${error}`);
      },
    );
}
