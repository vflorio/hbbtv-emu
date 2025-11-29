import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { parse, stringify } from "fp-ts-std/JSON";
import type * as t from "io-ts";
import { createLogger } from "../logger";
import { invalidDataError } from "../misc";
import type { StorageError } from "./errors";
import { createStorageAdapter, type StorageAdapter } from "./storageAdapter";

const logger = createLogger("Storage");

export class Storage<T> {
  key: string;
  storageAdapter: StorageAdapter;
  codec?: t.Type<T>;

  constructor(key: string, storageAdapter?: StorageAdapter, codec?: t.Type<T>) {
    this.key = key;
    this.storageAdapter = storageAdapter ?? createStorageAdapter();
    this.codec = codec;
  }

  load = (): TE.TaskEither<StorageError, T> =>
    pipe(
      this.storageAdapter.getItem(this.key),
      TE.flatMapEither(parse((error) => invalidDataError(`Failed to parse JSON: ${error.message}`))),
      TE.flatMapEither((data) =>
        this.codec
          ? pipe(
              this.codec.decode(data),
              E.mapLeft(() => invalidDataError(`Invalid data for key ${this.key}: ${JSON.stringify(data)}`)),
            )
          : E.right(data as T),
      ),
      TE.tapError((error) => TE.fromIO(logger.error("Failed to load entry:", error))),
    );

  save = (entry: T): TE.TaskEither<StorageError, void> =>
    pipe(
      entry,
      stringify((error) => invalidDataError(`Failed to stringify entry: ${error.message}`)),
      TE.fromEither,
      TE.flatMap((json) => this.storageAdapter.setItem(this.key, json)),
      TE.tapError((error) => TE.fromIO(logger.error("Failed to save entry:", error))),
    );
}
