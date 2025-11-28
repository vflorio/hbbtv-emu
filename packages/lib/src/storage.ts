import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import type * as t from "io-ts";
import { ChromeStorageAdapter } from "./chrome";
import type { JsonParseError, JsonStringifyError } from "./json";
import { jsonParse, jsonStringify } from "./json";
import { createLogger } from "./logger";
import { type DataNotFoundError, dataNotFoundError, type InvalidDataError, invalidDataError } from "./misc";

const logger = createLogger("Storage");

export interface StorageAdapter {
  getItem(key: string): TE.TaskEither<LocalStorageGetItemError | DataNotFoundError, string>;
  setItem(key: string, value: string): TE.TaskEither<LocalStorageSetItemError, void>;
}

export class LocalStorageAdapter implements StorageAdapter {
  getItem = (key: string): TE.TaskEither<LocalStorageGetItemError | DataNotFoundError, string> =>
    pipe(
      TE.tryCatch(
        () => Promise.resolve(localStorage.getItem(key)),
        (error): LocalStorageGetItemError => {
          logger.error("Failed to get item from localStorage:", error);
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
        logger.error("Failed to set item in localStorage:", error);
        return localStorageSetItemError(`LocalStorage setItem failed: ${error}`);
      },
    );
}

const createStorageAdapter = (): StorageAdapter =>
  typeof chrome !== "undefined" && chrome.storage?.local ? new ChromeStorageAdapter() : new LocalStorageAdapter();

export class Storage<T> {
  key: string;
  storageAdapter: StorageAdapter;
  codec?: t.Type<T>;

  constructor(key: string, storageAdapter: StorageAdapter = createStorageAdapter(), codec?: t.Type<T>) {
    this.key = key;
    this.storageAdapter = storageAdapter;
    this.codec = codec;
  }

  load = (): TE.TaskEither<StorageError, T> =>
    pipe(
      this.storageAdapter.getItem(this.key),
      TE.flatMapEither(jsonParse<unknown>),
      TE.flatMapEither((data) =>
        this.codec
          ? pipe(
              this.codec.decode(data),
              E.mapLeft(() => invalidDataError(`Invalid data for key ${this.key}: ${JSON.stringify(data)}`)),
            )
          : E.right(data as T),
      ),
      TE.mapLeft((error) => {
        logger.error("Failed to load entry:", error);
        return error;
      }),
    );

  save = (entry: T): TE.TaskEither<JsonStringifyError | LocalStorageSetItemError, void> =>
    pipe(
      jsonStringify(entry),
      TE.fromEither,
      TE.flatMap((json) => this.storageAdapter.setItem(this.key, json)),
      TE.mapLeft((error) => {
        logger.error("Failed to save entry:", error);
        return error;
      }),
    );
}

export class EntryStorage<T extends { id: string }> extends Storage<T[]> {
  constructor(key: string, storageAdapter: StorageAdapter = createStorageAdapter(), codec?: t.Type<T[]>) {
    super(key, storageAdapter, codec);
  }

  saveEntry = (entry: T): TE.TaskEither<StorageError, void> =>
    pipe(
      this.load(),
      TE.map((entries) =>
        pipe(
          entries,
          A.findIndex((e) => e.id === entry.id),
          O.match(
            () => [...entries, entry],
            (index) =>
              pipe(
                entries,
                A.updateAt(index, entry),
                O.getOrElse(() => entries),
              ),
          ),
        ),
      ),
      TE.flatMap((updatedEntries) => this.save(updatedEntries)),
    );

  deleteEntry = (id: string): TE.TaskEither<StorageError, void> =>
    pipe(
      this.load(),
      TE.map((entries) =>
        pipe(
          entries,
          A.filter((e) => e.id !== id),
        ),
      ),
      TE.flatMap((filtered) => this.save(filtered)),
    );
}

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
