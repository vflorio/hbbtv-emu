import type { BackgroundServiceError, ManifestVersion } from "@hbb-emu/extension-runtime";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { match } from "ts-pattern";

export interface StorageAdapter<T> {
  readonly read: () => TE.TaskEither<BackgroundServiceError, O.Option<T>>;
  readonly write: (state: T) => TE.TaskEither<BackgroundServiceError, void>;
}

/**
 * @since Chrome 19+ Firefox 15+
 */
export const createStorageAdapter = <T>(manifestVersion: ManifestVersion, storageKey: string): StorageAdapter<T> => ({
  read: () =>
    TE.tryCatch(
      () =>
        match(manifestVersion)
          .with(
            2,
            () =>
              new Promise<O.Option<T>>((resolve, reject) =>
                chrome.storage.local.get<Record<string, T>>(storageKey, (result) =>
                  chrome.runtime.lastError
                    ? reject(chrome.runtime.lastError)
                    : resolve(O.fromNullable(result[storageKey])),
                ),
              ),
          )
          .with(3, async () => {
            const data = await chrome.storage.local.get<Record<string, T>>(storageKey);
            return O.fromNullable(data[storageKey]);
          })
          .exhaustive(),
      (cause): BackgroundServiceError => ({
        _tag: "StorageReadError",
        cause,
      }),
    ),

  write: (state: T) =>
    TE.tryCatch(
      () => chrome.storage.local.set({ [storageKey]: state }),
      (cause): BackgroundServiceError => ({
        _tag: "StorageWriteError",
        cause,
      }),
    ),
});
