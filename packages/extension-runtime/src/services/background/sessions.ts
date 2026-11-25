/**
 * The TV session of every tab (ROADMAP D5): created when an HbbTV page first starts
 * in a tab, kept across the navigations of that tab, dropped when the tab closes.
 *
 * Kept in memory and written through to the session storage, so that a restarted
 * MV3 service worker finds them again. Storage failures are logged, never fatal:
 * the pages keep working with what is in memory.
 */

import type { Logger } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import type * as IO from "fp-ts/IO";
import { IORef } from "fp-ts/IORef";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { StorageAdapter } from "../../adapter";
import type { TvSession, TvSessions } from "../../state";

export type Sessions = Readonly<{
  /** Loads the stored sessions, keeping only those of tabs still open. */
  load: (openTabIds: ReadonlyArray<number>) => T.Task<void>;
  get: (tabId: number) => IO.IO<O.Option<TvSession>>;
  /** The tab's session, created with `initial` if the tab has none yet. */
  open: (tabId: number, initial: TvSession) => T.Task<TvSession>;
  /** Changes the tab's session; none if the tab has no session (it is not a TV). */
  update: (tabId: number, f: (session: TvSession) => TvSession) => T.Task<O.Option<TvSession>>;
  close: (tabId: number) => T.Task<void>;
}>;

const isTvSession = (value: unknown): value is TvSession => {
  if (typeof value !== "object" || value === null) return false;
  const session = value as Record<string, unknown>;
  return session.mode === "app" && (session.channelId === null || typeof session.channelId === "string");
};

/** What the storage returns may come from another version: anything unexpected is dropped. */
const keepValid = (stored: unknown, openTabIds: ReadonlyArray<number>): TvSessions => {
  if (typeof stored !== "object" || stored === null) return {};
  const open = new Set(openTabIds.map(String));
  return Object.fromEntries(
    Object.entries(stored as Record<string, unknown>).filter(
      (entry): entry is [string, TvSession] => open.has(entry[0]) && isTvSession(entry[1]),
    ),
  );
};

export const createSessions = (storage: StorageAdapter<TvSessions>, logger: Logger): Sessions => {
  const sessions = new IORef<TvSessions>({});

  const persist: T.Task<void> = pipe(
    T.fromIO(sessions.read),
    T.flatMap((all) => storage.write(all)),
    TE.getOrElseW((error) => T.fromIO(logger.warn("Could not store the TV sessions", error))),
  );

  const set = (all: TvSessions): T.Task<void> =>
    pipe(
      T.fromIO(sessions.write(all)),
      T.flatMap(() => persist),
    );

  const get =
    (tabId: number): IO.IO<O.Option<TvSession>> =>
    () =>
      O.fromNullable(sessions.read()[String(tabId)]);

  return {
    load: (openTabIds) =>
      pipe(
        storage.read(),
        TE.getOrElseW((error) =>
          pipe(
            T.fromIO(logger.warn("Could not read the TV sessions", error)),
            T.map(() => O.none),
          ),
        ),
        T.map(O.getOrElseW(() => ({}))),
        T.flatMap((stored) => set(keepValid(stored, openTabIds))),
      ),

    get,

    open: (tabId, initial) =>
      pipe(
        T.fromIO(get(tabId)),
        T.flatMap(
          O.match(
            () =>
              pipe(
                set({ ...sessions.read(), [String(tabId)]: initial }),
                T.tapIO(() => logger.info(`TV session opened in tab ${tabId}`, initial)),
                T.map(() => initial),
              ),
            T.of,
          ),
        ),
      ),

    update: (tabId, f) =>
      pipe(
        T.fromIO(get(tabId)),
        T.flatMap(
          O.match(
            () => T.of(O.none),
            (session) =>
              pipe(
                T.of(f(session)),
                T.tap((next) => set({ ...sessions.read(), [String(tabId)]: next })),
                T.map(O.some),
              ),
          ),
        ),
      ),

    close: (tabId) =>
      pipe(
        T.fromIO(get(tabId)),
        T.flatMap(
          O.match(
            (): T.Task<void> => T.of(undefined),
            () => {
              const { [String(tabId)]: _closed, ...rest } = sessions.read();
              return pipe(
                set(rest),
                T.tapIO(() => logger.info(`TV session closed with tab ${tabId}`)),
              );
            },
          ),
        ),
      ),
  };
};
