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

/**
 * Storage for what lasts as long as the browser session, not across restarts
 * (e.g. the TV session of each tab: tab ids do not survive a restart).
 *
 * MV3: `chrome.storage.session` (Chrome 102+), so it survives the service worker
 * being stopped. MV2: memory, which is enough since the background page is persistent.
 *
 * @since Chrome 102+ (MV3), any (MV2)
 */
export const createSessionStorageAdapter = <T>({ manifest, storageKey }: AdapterConfig): StorageAdapter<T> => {
  const key = `${storageKey}_sessions`;
  const area =
    manifest === MANIFEST_VERSION_3 ? (chrome.storage as { session?: chrome.storage.StorageArea }).session : undefined;
  if (!area) return createMemoryStorageAdapter<T>();
  return {
    read: () =>
      TE.tryCatch(
        async () => O.fromNullable((await area.get(key))[key] as T | undefined),
        (cause): AdapterError => ({ _tag: "StorageReadError", cause }),
      ),
    write: (state) =>
      TE.tryCatch(
        () => area.set({ [key]: state }),
        (cause): AdapterError => ({ _tag: "StorageWriteError", cause }),
      ),
  };
};

/** Lives as long as the page (or worker) that created it. */
export const createMemoryStorageAdapter = <T>(): StorageAdapter<T> => {
  let value: O.Option<T> = O.none;
  return {
    read: () => TE.right(value),
    write: (state) => {
      value = O.some(state);
      return TE.right(undefined);
    },
  };
};
