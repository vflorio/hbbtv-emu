import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";
import { type AdapterConfig, type AdapterError, MANIFEST_VERSION_2, MANIFEST_VERSION_3 } from "./adapter";

export interface StorageAdapter<T> {
  readonly read: () => TE.TaskEither<AdapterError, O.Option<T>>;
  readonly write: (state: T) => TE.TaskEither<AdapterError, void>;
}

/**
 * @since Chrome 19+ Firefox 15+
 */
export const createStorageAdapter = <T>({ manifest, storageKey }: AdapterConfig): StorageAdapter<T> => ({
  read: () =>
    TE.tryCatch(
      () =>
        match(manifest)
          .with(
            MANIFEST_VERSION_2,
            () =>
              new Promise<O.Option<T>>((resolve, reject) =>
                chrome.storage.local.get<Record<string, T>>(storageKey, (result) =>
                  chrome.runtime.lastError
                    ? reject(chrome.runtime.lastError)
                    : resolve(O.fromNullable(result[storageKey])),
                ),
              ),
          )
          .with(MANIFEST_VERSION_3, async () => {
            const data = await chrome.storage.local.get<Record<string, T>>(storageKey);
            return O.fromNullable(data[storageKey]);
          })
          .exhaustive(),
      (cause): AdapterError => ({
        _tag: "StorageReadError",
        cause,
      }),
    ),

  write: (state: T) =>
    TE.tryCatch(
      () => chrome.storage.local.set({ [storageKey]: state }),
      (cause): AdapterError => ({
        _tag: "StorageWriteError",
        cause,
      }),
    ),
});
