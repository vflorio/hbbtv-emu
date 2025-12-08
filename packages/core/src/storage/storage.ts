import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import type * as t from "io-ts";
import { jsonParse, jsonStringify } from "../lib/json";
import { invalidDataError } from "../lib/misc";
import { createLogger } from
"../l../misc

import type { StorageError } from "./errors";
import type { StorageAdapter } from "./storageAdapter";

const logger = createLogger("Storage");

const isDataNotFoundError = (error: StorageError): boolean => error.type === "DataNotFoundError";

export class Storage<T> {
  key: string;
  storageAdapter: StorageAdapter;
  codec?: t.Type<T>;

  constructor(key: string, storageAdapter: StorageAdapter, codec?: t.Type<T>) {
    this.key = key;
    this.storageAdapter = storageAdapter;
    this.codec = codec;
  }

  load = (): TE.TaskEither<StorageError, T> =>
    pipe(
      this.storageAdapter.getItem(this.key),
      TE.flatMapEither((json) =>
        pipe(
          jsonParse<unknown>(json),
          E.mapLeft((e) => invalidDataError(e.message)),
        ),
      ),
      TE.flatMapEither((data) =>
        this.codec
          ? pipe(
              this.codec.decode(data),
              E.mapLeft(() => invalidDataError(`Invalid data for key ${this.key}: ${JSON.stringify(data)}`)),
            )
          : E.right(data as T),
      ),
      TE.tapError((error) =>
        isDataNotFoundError(error)
          ? TE.fromIO(logger.debug("No saved data found, using defaults"))
          : TE.fromIO(logger.error("Failed to load entry:", error)),
      ),
    );

  save = (entry: T): TE.TaskEither<StorageError, void> =>
    pipe(
      jsonStringify(entry),
      E.mapLeft((e) => invalidDataError(e.message)),
      TE.fromEither,
      TE.flatMap((json) => this.storageAdapter.setItem(this.key, json)),
      TE.tapError((error) => TE.fromIO(logger.error("Failed to save entry:", error))),
    );
}
