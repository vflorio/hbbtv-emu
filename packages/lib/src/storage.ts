import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import type * as t from "io-ts";
import { ChromeStorageAdapter } from "./chrome";
import { createLogger } from "./logger";
import { jsonParse, jsonStringify } from "./misc";

const logger = createLogger("Storage");

export interface StorageAdapter {
  getItem(key: string): TE.TaskEither<Error, string>;
  setItem(key: string, value: string): TE.TaskEither<Error, void>;
}

export class LocalStorageAdapter implements StorageAdapter {
  getItem = (key: string): TE.TaskEither<Error, string> =>
    pipe(
      TE.tryCatch(
        () => Promise.resolve(localStorage.getItem(key)),
        (error): Error => {
          logger.error("Failed to get item from localStorage:", error);
          return new Error(`LocalStorage getItem failed: ${error}`);
        },
      ),
      TE.chainOptionK(() => new Error("No data found"))(O.fromNullable),
    );

  setItem = (key: string, value: string): TE.TaskEither<Error, void> =>
    TE.tryCatch(
      () => {
        localStorage.setItem(key, value);
        return Promise.resolve();
      },
      (error): Error => {
        logger.error("Failed to set item in localStorage:", error);
        return new Error(`LocalStorage setItem failed: ${error}`);
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

  load = (): TE.TaskEither<Error, T> =>
    pipe(
      this.storageAdapter.getItem(this.key),
      TE.flatMapEither(jsonParse<unknown>),
      TE.flatMapEither((data) =>
        this.codec
          ? pipe(
              this.codec.decode(data),
              E.mapLeft(() => new Error(`Invalid data for key ${this.key}: ${JSON.stringify(data)}`)),
            )
          : E.right(data as T),
      ),
      TE.mapLeft((error) => {
        logger.error("Failed to load entry:", error);
        return error;
      }),
    );

  save = (entry: T): TE.TaskEither<Error, void> =>
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

  saveEntry = (entry: T): TE.TaskEither<Error, void> =>
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

  deleteEntry = (id: string): TE.TaskEither<Error, void> =>
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
